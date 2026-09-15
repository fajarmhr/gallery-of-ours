import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { invites, user } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { emails, sendEmail } from "@/lib/email";
import { hasResend } from "@/lib/env";

/** How long an invite link works. */
export const INVITE_DAYS = 7;

/** How long the sign-up code emailed to an invited person works. The `invites.codeHint` text says the same. */
export const INVITE_CODE_MINUTES = 10;

/** Set while an invite sign-up creates the account, so Better Auth doesn't also send its confirmation link. */
export const inviteSignup = new AsyncLocalStorage<{ inviteId: string }>();

export const inviteUrl = (appUrl: string, token: string) => `${appUrl}/sign-up?invite=${encodeURIComponent(token)}`;

/** "anisa@gmail.com" → "an•••@gmail.com": enough to recognise where the code went. */
export function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const name = email.slice(0, at);
  return `${name.slice(0, Math.min(2, name.length - 1) || 1)}•••${email.slice(at)}`;
}

/**
 * An invite link that still works, with the name of the admin who made it. It is either open, or already tied to
 * an account that still has to enter its email code (`pendingUserId`, `pendingEmail`). Null otherwise.
 */
export async function getInviteForSignUp(token: string) {
  const joined = alias(user, "joined_user");
  const [row] = await db
    .select({
      id: invites.id,
      invitedBy: user.name,
      usedAt: invites.usedAt,
      joinedId: joined.id,
      joinedEmail: joined.email,
      joinedVerified: joined.emailVerified,
      joinedStatus: joined.status,
    })
    .from(invites)
    .leftJoin(user, eq(invites.createdById, user.id))
    .leftJoin(joined, eq(invites.usedById, joined.id))
    .where(and(eq(invites.token, token), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  if (!row.usedAt) return { id: row.id, invitedBy: row.invitedBy, pendingUserId: null, pendingEmail: null };
  if (row.joinedId && row.joinedEmail && !row.joinedVerified && row.joinedStatus === "pending") {
    return { id: row.id, invitedBy: row.invitedBy, pendingUserId: row.joinedId, pendingEmail: row.joinedEmail };
  }
  return null;
}

/** True when the account was made through an invite link. */
export async function isInvitedAccount(userId: string) {
  const [row] = await db.select({ id: invites.id }).from(invites).where(eq(invites.usedById, userId)).limit(1);
  return Boolean(row);
}

/** Lets an invited account in once its email is confirmed. Safe to call again; true only when it approved just now. */
export async function approveInvitedAccount(userId: string) {
  const [invite] = await db.select({ id: invites.id }).from(invites).where(eq(invites.usedById, userId)).limit(1);
  if (!invite) return false;
  const [approved] = await db
    .update(user)
    .set({ status: "active" })
    .where(and(eq(user.id, userId), eq(user.status, "pending"), eq(user.emailVerified, true)))
    .returning({ id: user.id });
  if (!approved) return false;
  await logActivity(userId, "user.join", "user", userId, { inviteId: invite.id });
  return true;
}

/** Emails the sign-up code in the person's language. */
export async function sendCodeEmail(email: string, code: string) {
  // Without Resend the email is only printed to the log, which nobody reads on Vercel: fail loudly instead.
  if (!hasResend() && process.env.VERCEL) throw new Error("RESEND_API_KEY isn't set, so the sign-up code can't be emailed.");
  const [row] = await db.select({ name: user.name, locale: user.locale }).from(user).where(eq(user.email, email)).limit(1);
  await sendEmail(email, emails.code(row?.locale === "id" ? "id" : "en", row?.name ?? "", code, INVITE_CODE_MINUTES));
}
