"use server";

import { randomBytes } from "node:crypto";
import { APIError } from "better-auth/api";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { INVITE_DAYS, inviteSignup, inviteUrl } from "@/lib/invites";
import { assertAdmin } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

export async function createInvite(note: string | null) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const label = note?.trim() || null;
    if (label && label.length > 80) throw new UserError("invalid_input");

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
    const [created] = await db.insert(invites).values({ token, note: label, createdById: current.id, expiresAt }).returning({ id: invites.id });
    await logActivity(current.id, "invite.create", "invite", created!.id);
    revalidatePath("/family");
    return { url: inviteUrl(env.appUrl, token) };
  });
}

export async function revokeInvite(inviteId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, inviteId), isNull(invites.usedAt)));
    await logActivity(current.id, "invite.revoke", "invite", inviteId);
    revalidatePath("/family");
    return null;
  });
}

const InviteSignUp = z.object({
  token: z.string().min(16).max(100),
  name: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_.]+$/),
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
  password: z.string().min(8).max(128),
  relationNote: z.string().trim().max(120).nullable(),
  locale: z.enum(["en", "id"]),
});

/**
 * Creates an approved, verified account from an invite link and signs the person in.
 * Better Auth problems (username taken and so on) come back as "auth:<CODE>".
 */
export async function signUpWithInvite(input: z.input<typeof InviteSignUp>) {
  return run(async () => {
    const parsed = InviteSignUp.safeParse(input);
    if (!parsed.success) throw new UserError("invalid_input");
    const { token, password, relationNote, ...profile } = parsed.data;
    const requestHeaders = await headers();

    // Claim the link before creating the account, so one link can't make two accounts at once.
    const [claimed] = await db
      .update(invites)
      .set({ usedAt: new Date() })
      .where(and(eq(invites.token, token), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
      .returning({ id: invites.id });
    if (!claimed) throw new UserError("invite_invalid");

    let userId: string;
    try {
      const created = await inviteSignup.run({ inviteId: claimed.id }, () =>
        auth.api.signUpEmail({ body: { ...profile, password, relationNote: relationNote || undefined }, headers: requestHeaders }),
      );
      userId = created.user.id;
    } catch (error) {
      await db.update(invites).set({ usedAt: null }).where(eq(invites.id, claimed.id));
      if (error instanceof APIError) throw new UserError(`auth:${error.body?.code ?? "UNKNOWN"}`);
      throw error;
    }

    await db.update(invites).set({ usedById: userId }).where(eq(invites.id, claimed.id));
    await logActivity(userId, "user.join", "user", userId, { inviteId: claimed.id });
    const signedIn = await auth.api.signInEmail({ body: { email: profile.email, password }, headers: requestHeaders }).then(
      () => true,
      (error) => {
        console.warn("Signing in after an invite sign-up failed", error);
        return false;
      },
    );
    return { signedIn };
  });
}
