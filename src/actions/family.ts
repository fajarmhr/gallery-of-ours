"use server";

import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { albums, editGrants, session, user, verification } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { emails, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { assertAdmin, assertSuperadmin, type Role } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

async function loadTarget(userId: string) {
  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!target) throw new UserError("not_found");
  return target;
}

export async function approveUser(userId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const target = await loadTarget(userId);
    if (target.status === "active") return null;
    await db.update(user).set({ status: "active", role: "member" }).where(eq(user.id, userId));
    await logActivity(current.id, "user.approve", "user", userId);
    try {
      await sendEmail(target.email, emails.approved(target.locale === "id" ? "id" : "en", target.name, `${env.appUrl}/home`));
    } catch (error) {
      console.warn("Approval email failed", error);
    }
    revalidatePath("/family");
    revalidatePath("/home");
    return null;
  });
}

export async function rejectUser(userId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const target = await loadTarget(userId);
    if (target.role !== "member") throw new UserError("forbidden");
    await db.update(user).set({ status: "rejected" }).where(eq(user.id, userId));
    await db.delete(session).where(eq(session.userId, userId));
    await logActivity(current.id, "user.reject", "user", userId);
    revalidatePath("/family");
    return null;
  });
}

export async function setUserRole(userId: string, role: Role) {
  return run(async () => {
    const current = await actionUser();
    assertSuperadmin(current);
    if (!["superadmin", "admin", "member"].includes(role)) throw new UserError("invalid_input");
    const target = await loadTarget(userId);
    if (target.status !== "active") throw new UserError("not_active");
    if (target.role === "superadmin" && role !== "superadmin") {
      const [row] = await db.select({ value: count() }).from(user).where(eq(user.role, "superadmin"));
      if ((row?.value ?? 0) <= 1) throw new UserError("last_superadmin");
    }
    await db.update(user).set({ role }).where(eq(user.id, userId));
    if (role !== "member") {
      await db.update(editGrants).set({ revokedAt: new Date() }).where(and(eq(editGrants.userId, userId), isNull(editGrants.revokedAt)));
    }
    await logActivity(current.id, "user.role", "user", userId, { from: target.role, to: role });
    revalidatePath("/family");
    return null;
  });
}

/**
 * Removes someone from the family gallery for good (superadmins only). Their sign-ins, favorites, comments, reactions and
 * editing access go with the account; the photos, videos and albums they added stay, without an uploader name.
 */
export async function removeUser(userId: string) {
  return run(async () => {
    const current = await actionUser();
    assertSuperadmin(current);
    const target = await loadTarget(userId);
    if (target.id === current.id) throw new UserError("forbidden");
    // Another superadmin must be given a lower role first, so nobody at the top is removed by accident.
    if (target.role === "superadmin") throw new UserError("forbidden");

    // Password reset tokens keep the user id; email codes keep the address.
    const codeIdentifiers = ["email-verification", "sign-in", "forget-password"].map((type) => `${type}-otp-${target.email}`);
    await db.delete(verification).where(or(eq(verification.value, target.id), inArray(verification.identifier, codeIdentifiers)));
    await db.delete(user).where(eq(user.id, target.id));
    await logActivity(current.id, "user.remove", "user", target.id, { name: target.name, role: target.role });
    revalidatePath("/family");
    return null;
  });
}

export async function grantEditing(userId: string, input: { albumId: string | null; days: number | null }) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const target = await loadTarget(userId);
    if (target.role !== "member" || target.status !== "active") throw new UserError("invalid_input");
    if (input.days !== null && (!Number.isInteger(input.days) || input.days < 1 || input.days > 365)) {
      throw new UserError("invalid_input");
    }
    if (input.albumId) {
      const [album] = await db.select({ id: albums.id }).from(albums).where(eq(albums.id, input.albumId)).limit(1);
      if (!album) throw new UserError("album_missing");
    }
    await db.update(editGrants).set({ revokedAt: new Date() }).where(and(eq(editGrants.userId, userId), isNull(editGrants.revokedAt)));
    await db.insert(editGrants).values({
      userId,
      albumId: input.albumId,
      grantedById: current.id,
      expiresAt: input.days ? new Date(Date.now() + input.days * 86_400_000) : null,
    });
    await logActivity(current.id, "grant.create", "user", userId, input);
    revalidatePath("/family");
    return null;
  });
}

export async function revokeEditing(userId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db.update(editGrants).set({ revokedAt: new Date() }).where(and(eq(editGrants.userId, userId), isNull(editGrants.revokedAt)));
    await logActivity(current.id, "grant.revoke", "user", userId);
    revalidatePath("/family");
    return null;
  });
}
