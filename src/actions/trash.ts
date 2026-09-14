"use server";

import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { assertAdmin } from "@/lib/permissions";
import { actionUser } from "@/lib/session";
import { storage } from "@/lib/storage";
import { removeStoredMedia } from "@/lib/storage-layout";

const TRASH_DAYS = 30;

/** Deletes the rows and every stored file: the original in its album folder and the sizes the app made. */
async function destroyMedia(ids: string[]) {
  if (!ids.length) return;
  const rows = await db
    .select({ id: media.id, source: media.source, originalKey: media.originalKey, originalName: media.originalName, type: media.type })
    .from(media)
    .where(inArray(media.id, ids));
  // Imported Cloudinary files are deleted from that Cloudinary account too.
  for (const row of rows) await removeStoredMedia(row);
  await db.delete(media).where(inArray(media.id, ids));
}

async function destroyAlbums(ids: string[]) {
  if (!ids.length) return;
  const files = await storage();
  const items = await db.select({ id: media.id }).from(media).where(inArray(media.albumId, ids));
  await destroyMedia(items.map((i) => i.id));
  const rows = await db.select({ id: albums.id, musicKey: albums.musicKey }).from(albums).where(inArray(albums.id, ids));
  for (const row of rows) {
    if (row.musicKey) await files.remove(row.musicKey);
    // Music uploaded before album folders lived under albums/<id>/.
    await files.removePrefix(`albums/${row.id}/`);
  }
  await db.delete(albums).where(inArray(albums.id, ids));
}

const refresh = () => {
  revalidatePath("/trash");
  revalidatePath("/albums");
};

export async function restoreFromTrash(input: { mediaIds?: string[]; albumIds?: string[] }) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    if (input.mediaIds?.length) await db.update(media).set({ deletedAt: null }).where(inArray(media.id, input.mediaIds));
    if (input.albumIds?.length) await db.update(albums).set({ deletedAt: null }).where(inArray(albums.id, input.albumIds));
    await logActivity(current.id, "trash.restore", "trash", null, input);
    refresh();
    return null;
  });
}

export async function deleteForever(input: { mediaIds?: string[]; albumIds?: string[] }) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const mediaIds = input.mediaIds ?? [];
    const albumIds = input.albumIds ?? [];
    if (mediaIds.length) {
      const rows = await db.select({ id: media.id }).from(media).where(and(inArray(media.id, mediaIds), isNotNull(media.deletedAt)));
      if (rows.length !== mediaIds.length) throw new UserError("not_in_trash");
    }
    if (albumIds.length) {
      const rows = await db.select({ id: albums.id }).from(albums).where(and(inArray(albums.id, albumIds), isNotNull(albums.deletedAt)));
      if (rows.length !== albumIds.length) throw new UserError("not_in_trash");
    }
    await destroyMedia(mediaIds);
    await destroyAlbums(albumIds);
    await logActivity(current.id, "trash.delete", "trash", null, { media: mediaIds.length, albums: albumIds.length });
    refresh();
    return null;
  });
}

/** Removes anything that has been in the trash longer than 30 days. Safe to call often. */
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000);
  const oldMedia = await db.select({ id: media.id }).from(media).where(and(isNotNull(media.deletedAt), lt(media.deletedAt, cutoff)));
  const oldAlbums = await db.select({ id: albums.id }).from(albums).where(and(isNotNull(albums.deletedAt), lt(albums.deletedAt, cutoff)));
  await destroyMedia(oldMedia.map((m) => m.id));
  await destroyAlbums(oldAlbums.map((a) => a.id));
  return { media: oldMedia.length, albums: oldAlbums.length };
}
