"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { albums, shareLinks } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { env } from "@/lib/env";
import { assertAdmin } from "@/lib/permissions";
import { getActiveShareLink, shareCookieName, shareCookieValue } from "@/lib/queries";
import { actionUser } from "@/lib/session";
import { hashSecret, randomToken, verifySecret } from "@/lib/signing";

export type ShareLinkView = {
  id: string;
  url: string;
  hasPassword: boolean;
  expiresAt: string | null;
  viewCount: number;
  active: boolean;
  createdAt: string;
};

export async function listShareLinks(albumId: string) {
  return run<ShareLinkView[]>(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const rows = await db.select().from(shareLinks).where(eq(shareLinks.albumId, albumId)).orderBy(desc(shareLinks.createdAt));
    return rows.map((link) => ({
      id: link.id,
      url: `${env.appUrl}/s/${link.token}`,
      hasPassword: Boolean(link.passwordHash),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      viewCount: link.viewCount,
      active: !link.revokedAt && !(link.expiresAt && link.expiresAt.getTime() < Date.now()),
      createdAt: link.createdAt.toISOString(),
    }));
  });
}

export async function createShareLink(albumId: string, input: { expiresInDays: number | null; password: string | null }) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const [album] = await db
      .select({ id: albums.id, unlockAt: albums.unlockAt })
      .from(albums)
      .where(and(eq(albums.id, albumId), isNull(albums.deletedAt)))
      .limit(1);
    if (!album) throw new UserError("album_missing");
    if (album.unlockAt && album.unlockAt.getTime() > Date.now()) throw new UserError("capsule_locked");
    const password = input.password?.trim() || null;
    if (password && password.length < 4) throw new UserError("password_too_short");
    const token = randomToken();
    await db.insert(shareLinks).values({
      albumId,
      token,
      passwordHash: password ? await hashSecret(password) : null,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
      createdById: current.id,
    });
    await logActivity(current.id, "share.create", "album", albumId);
    return { url: `${env.appUrl}/s/${token}` };
  });
}

export async function revokeShareLink(linkId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, linkId));
    await logActivity(current.id, "share.revoke", "share", linkId);
    return null;
  });
}

export async function unlockShareLink(token: string, password: string) {
  return run(async () => {
    const link = await getActiveShareLink(token);
    if (!link) throw new UserError("link_expired");
    if (!link.passwordHash) return null;
    if (!(await verifySecret(password, link.passwordHash))) throw new UserError("wrong_password");
    (await cookies()).set(shareCookieName(token), shareCookieValue(link), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return null;
  });
}
