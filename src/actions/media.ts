"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { processMedia } from "@/lib/media-processing";
import { assertAdmin, assertCanEditAlbum, isAdmin, PermissionError } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

async function loadEditable(ids: string[]) {
  const current = await actionUser();
  if (ids.length === 0 || ids.length > 500) throw new UserError("invalid_input");
  const rows = await db.select().from(media).where(inArray(media.id, ids));
  for (const albumId of new Set(rows.map((r) => r.albumId))) await assertCanEditAlbum(current, albumId);
  return { current, rows };
}

export async function updateCaption(mediaId: string, caption: string) {
  return run(async () => {
    const { current, rows } = await loadEditable([mediaId]);
    const item = rows[0];
    if (!item) throw new UserError("not_found");
    const value = caption.trim();
    if (value.length > 500) throw new UserError("invalid_input");
    await db.update(media).set({ caption: value || null }).where(eq(media.id, mediaId));
    await logActivity(current.id, "media.caption", "media", mediaId);
    revalidatePath(`/albums/${item.albumId}`);
    return null;
  });
}

export async function moveMedia(mediaIds: string[], targetAlbumId: string) {
  return run(async () => {
    const { current, rows } = await loadEditable(mediaIds);
    await assertCanEditAlbum(current, targetAlbumId);
    const [target] = await db
      .select({ id: albums.id })
      .from(albums)
      .where(and(eq(albums.id, targetAlbumId), isNull(albums.deletedAt)))
      .limit(1);
    if (!target) throw new UserError("album_missing");
    await db.update(media).set({ albumId: targetAlbumId }).where(inArray(media.id, mediaIds));
    await db.update(albums).set({ coverMediaId: null }).where(inArray(albums.coverMediaId, mediaIds));
    await logActivity(current.id, "media.move", "album", targetAlbumId, { count: mediaIds.length });
    for (const albumId of new Set([...rows.map((r) => r.albumId), targetAlbumId])) revalidatePath(`/albums/${albumId}`);
    revalidatePath("/albums");
    return null;
  });
}

export async function trashMedia(mediaIds: string[]) {
  return run(async () => {
    const { current, rows } = await loadEditable(mediaIds);
    await db.update(media).set({ deletedAt: new Date() }).where(inArray(media.id, mediaIds));
    await db.update(albums).set({ coverMediaId: null }).where(inArray(albums.coverMediaId, mediaIds));
    await logActivity(current.id, "media.trash", "media", null, { count: mediaIds.length });
    for (const albumId of new Set(rows.map((r) => r.albumId))) revalidatePath(`/albums/${albumId}`);
    revalidatePath("/trash");
    return null;
  });
}

export async function reprocessMedia(mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!item) throw new UserError("not_found");
    if (item.uploaderId !== current.id && !isAdmin(current)) throw new PermissionError();
    await db.update(media).set({ status: "processing" }).where(eq(media.id, mediaId));
    after(() => processMedia(mediaId));
    return null;
  });
}

export async function clearAiCaption(mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db.update(media).set({ aiCaption: null, aiTags: null }).where(eq(media.id, mediaId));
    return null;
  });
}
