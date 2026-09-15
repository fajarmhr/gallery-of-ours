"use server";

import { randomBytes } from "node:crypto";
import { APIError } from "better-auth/api";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { invites, user, verification } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  approveInvitedAccount,
  getInviteForSignUp,
  INVITE_CODE_MINUTES,
  INVITE_DAYS,
  inviteSignup,
  inviteUrl,
  maskEmail,
  sendCodeEmail,
} from "@/lib/invites";
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

const InviteCode = z.object({
  token: z.string().min(16).max(100),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

/** How soon someone may ask for another code. */
const RESEND_AFTER_SECONDS = 60;

/** Where Better Auth's email code plugin keeps the code for an email. */
const codeIdentifier = (email: string) => `email-verification-otp-${email}`;

/** Replaces any earlier code for this email with a new one and emails it. False when the email couldn't be sent. */
async function sendFreshCode(email: string) {
  await db.delete(verification).where(eq(verification.identifier, codeIdentifier(email)));
  const code = await auth.api.createVerificationOTP({ body: { email, type: "email-verification" } });
  try {
    await sendCodeEmail(email, code);
    return true;
  } catch (error) {
    console.error("Sending an invite sign-up code failed", error);
    return false;
  }
}

/**
 * Step 1 of joining through an invite: creates the account (unverified and pending), ties it to the link and
 * emails a sign-up code. Better Auth problems (username taken and so on) come back as "auth:<CODE>".
 */
export async function signUpWithInvite(input: z.input<typeof InviteSignUp>) {
  return run(async () => {
    const parsed = InviteSignUp.safeParse(input);
    if (!parsed.success) throw new UserError("invalid_input");
    const { token, password, relationNote, ...profile } = parsed.data;
    const requestHeaders = await headers();

    // With email confirmation on, Better Auth answers a taken email with a pretend success, so check first.
    const [taken] = await db
      .select({ email: user.email })
      .from(user)
      .where(or(eq(user.email, profile.email), eq(user.username, profile.username)))
      .limit(1);
    if (taken) throw new UserError(taken.email === profile.email ? "auth:USER_ALREADY_EXISTS" : "auth:USERNAME_IS_ALREADY_TAKEN");

    // Claim the link before creating the account, so one link can't make two accounts at once.
    const [claimed] = await db
      .update(invites)
      .set({ usedAt: new Date() })
      .where(and(eq(invites.token, token), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
      .returning({ id: invites.id });
    if (!claimed) throw new UserError("invite_invalid");

    try {
      const created = await inviteSignup.run({ inviteId: claimed.id }, () =>
        auth.api.signUpEmail({ body: { ...profile, password, relationNote: relationNote || undefined }, headers: requestHeaders }),
      );
      await db.update(invites).set({ usedById: created.user.id }).where(eq(invites.id, claimed.id));
    } catch (error) {
      await db.update(invites).set({ usedAt: null, usedById: null }).where(eq(invites.id, claimed.id));
      if (error instanceof APIError) throw new UserError(`auth:${error.body?.code ?? "UNKNOWN"}`);
      throw error;
    }

    const codeSent = await sendFreshCode(profile.email);
    return { email: maskEmail(profile.email), codeSent };
  });
}

/**
 * Step 2: checks the emailed code. That confirms the email, the invite approves the account (in the auth
 * config's afterEmailVerification) and Better Auth signs the person in.
 */
export async function verifyInviteCode(input: z.input<typeof InviteCode>) {
  return run(async () => {
    const parsed = InviteCode.safeParse(input);
    if (!parsed.success) throw new UserError("code_invalid");
    const invite = await getInviteForSignUp(parsed.data.token);
    if (!invite?.pendingUserId || !invite.pendingEmail) throw new UserError("invite_invalid");

    try {
      await auth.api.verifyEmailOTP({ body: { email: invite.pendingEmail, otp: parsed.data.code }, headers: await headers() });
    } catch (error) {
      const code = error instanceof APIError ? error.body?.code : undefined;
      if (code === "INVALID_OTP") throw new UserError("code_invalid");
      if (code === "OTP_EXPIRED" || code === "TOO_MANY_ATTEMPTS") throw new UserError("code_expired");
      throw error;
    }
    // Normally already done by afterEmailVerification; this only matters if that step failed.
    await approveInvitedAccount(invite.pendingUserId);
    return null;
  });
}

/** Emails a new code to the account waiting on this invite, at most once a minute. */
export async function resendInviteCode(token: string) {
  return run(async () => {
    const invite = await getInviteForSignUp(String(token).slice(0, 100));
    if (!invite?.pendingEmail) throw new UserError("invite_invalid");
    // Wrong tries rewrite the stored code, but its expiry stays, so the expiry tells when it was sent.
    const sentAfter = new Date(Date.now() + (INVITE_CODE_MINUTES * 60 - RESEND_AFTER_SECONDS) * 1000);
    const [recent] = await db
      .select({ id: verification.id })
      .from(verification)
      .where(and(eq(verification.identifier, codeIdentifier(invite.pendingEmail)), gt(verification.expiresAt, sentAfter)))
      .limit(1);
    if (recent) throw new UserError("code_wait");
    if (!(await sendFreshCode(invite.pendingEmail))) throw new UserError("code_not_sent");
    return null;
  });
}

/** "Wrong email?": removes the account that is still waiting for its code, so the link can be used again. */
export async function restartInviteSignUp(token: string) {
  return run(async () => {
    const invite = await getInviteForSignUp(String(token).slice(0, 100));
    if (!invite?.pendingUserId || !invite.pendingEmail) throw new UserError("invite_invalid");
    const [removed] = await db
      .delete(user)
      .where(and(eq(user.id, invite.pendingUserId), eq(user.status, "pending"), eq(user.emailVerified, false)))
      .returning({ id: user.id });
    if (!removed) throw new UserError("invite_invalid");
    await db.delete(verification).where(eq(verification.identifier, codeIdentifier(invite.pendingEmail)));
    await db.update(invites).set({ usedAt: null, usedById: null }).where(eq(invites.id, invite.id));
    return null;
  });
}
