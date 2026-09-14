import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, user } from "@/db/schema";

/** How long an invite link works. */
export const INVITE_DAYS = 7;

/** Set while an invite sign-up runs, so the auth hook approves and verifies the new account. */
export const inviteSignup = new AsyncLocalStorage<{ inviteId: string }>();

export const inviteUrl = (appUrl: string, token: string) => `${appUrl}/sign-up?invite=${encodeURIComponent(token)}`;

/** An invite that can still be used, with the name of the admin who made it; null otherwise. */
export async function getInviteForSignUp(token: string) {
  const [row] = await db
    .select({ id: invites.id, invitedBy: user.name })
    .from(invites)
    .leftJoin(user, eq(invites.createdById, user.id))
    .where(and(eq(invites.token, token), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}
