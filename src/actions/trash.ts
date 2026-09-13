"use server";

import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { destroyCloudinaryMedia, isCloudinarySource } from "@/lib/cloudinary";
import { assertAdmin } from "@/lib/permissions";
import { actionUser } from "@/lib/session";
import { mediaKeys, storage } from "@/lib/storage";

const TRASH_DAYS = 30;

async function destroyMedia(ids: string[]) {
  if (!ids.length) return;
  const files = await storage();
  const rows = await db
    .select({ id: media.id, source: media.source, originalKey: media.originalKey, originalName: media.originalName, type: media.type })
    .from(media)
    .where(inArray(media.id, ids));
  for (const row of rows) {
    // Imported Cloudinary files are deleted from that Cloudinary account too.
    if (isCloudinarySource(row.source)) await destroyCloudinaryMedia(row);
    else await files.removePrefix(mediaKeys(row.id).prefix);
  }
  await db.delete(media).where(inArray(media.id, ids));
}

async function destroyAlbums(ids: string[]) {
  if (!ids.length) return;
  const files = await storage();
  const items = await db.select({ id: media.id }).from(media).where(inArray(media.albumId, ids));
  await destroyMedia(items.map((i) => i.id));
  for (const id of ids) await files.removePrefix(`albums/${id}/`);
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
