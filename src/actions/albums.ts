"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import {
  assertCanEditAlbum,
  canCreateAlbum,
  isAdmin,
  PermissionError,
} from "@/lib/permissions";
import { actionUser } from "@/lib/session";
import { extensionFor, storage } from "@/lib/storage";
import { albumFolder, musicPath, organizeAlbum } from "@/lib/storage-layout";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const AlbumInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(80).nullable().optional(),
  category: z.enum(["trips", "celebrations", "everyday", "other"]),
  startDate: optionalDate,
  endDate: optionalDate,
  unlockAt: optionalDate,
});

export type AlbumInputValues = z.input<typeof AlbumInput>;

function parseAlbum(input: AlbumInputValues) {
  const parsed = AlbumInput.safeParse(input);
  if (!parsed.success) throw new UserError("invalid_input");
  const data = parsed.data;
  if (data.startDate && data.endDate && data.endDate < data.startDate) throw new UserError("invalid_dates");
  return {
    title: data.title,
    description: data.description || null,
    note: data.note || null,
    category: data.category,
    startDate: data.startDate || null,
    endDate: data.endDate || data.startDate || null,
    unlockAt: data.unlockAt ? new Date(`${data.unlockAt}T00:00:00`) : null,
  };
}

export async function createAlbum(input: AlbumInputValues) {
  return run(async () => {
    const current = await actionUser();
    if (!(await canCreateAlbum(current))) throw new PermissionError();
    const values = parseAlbum(input);
    if (values.unlockAt && !isAdmin(current)) throw new PermissionError();
    const [created] = await db
      .insert(albums)
      .values({ ...values, createdById: current.id })
      .returning({ id: albums.id });
    await logActivity(current.id, "album.create", "album", created!.id, { title: values.title });
    revalidatePath("/albums");
    return { id: created!.id };
  });
}

/** Saves album details; a new title also renames the album's storage folder, in the background. */
export async function updateAlbum(albumId: string, input: AlbumInputValues) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const [existing] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!existing || existing.deletedAt) throw new UserError("album_missing");
    const values = parseAlbum(input);
    const capsuleChanged = (existing.unlockAt?.getTime() ?? null) !== (values.unlockAt?.getTime() ?? null);
    if (capsuleChanged && !isAdmin(current)) throw new PermissionError();
    await db.update(albums).set(values).where(eq(albums.id, albumId));
    if (values.title !== existing.title) {
      after(() => organizeAlbum(albumId).catch((error) => console.error(`Filing album ${albumId} into its renamed folder failed`, error)));
    }
    await logActivity(current.id, "album.update", "album", albumId);
    revalidatePath("/albums");
    revalidatePath(`/albums/${albumId}`);
    return null;
  });
}

export async function setAlbumCover(albumId: string, mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const [item] = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.albumId, albumId), isNull(media.deletedAt)))
      .limit(1);
    if (!item) throw new UserError("not_found");
    await db.update(albums).set({ coverMediaId: mediaId }).where(eq(albums.id, albumId));
    revalidatePath("/albums");
    revalidatePath(`/albums/${albumId}`);
    return null;
  });
}

export async function trashAlbum(albumId: string) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    await db.update(albums).set({ deletedAt: new Date() }).where(eq(albums.id, albumId));
    await logActivity(current.id, "album.trash", "album", albumId);
    revalidatePath("/albums");
    revalidatePath("/trash");
    return null;
  });
}

async function loadAlbum(albumId: string) {
  const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album || album.deletedAt) throw new UserError("album_missing");
  return album;
}

/** Story music is filed next to the album's photos, as "Story music.<ext>". */
export async function startAlbumMusicUpload(albumId: string, filename: string, mime: string, size: number) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    if (!mime.startsWith("audio/")) throw new UserError("unsupported_file");
    if (size > 30 * 1024 * 1024) throw new UserError("file_too_large");
    const album = await loadAlbum(albumId);
    const key = musicPath(await albumFolder(album), extensionFor(filename, mime));
    const target = await (await storage()).presignPut(key, mime);
    return { key, ...target };
  });
}

export async function finishAlbumMusicUpload(albumId: string, key: string) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const album = await loadAlbum(albumId);
    if (key !== musicPath(await albumFolder(album), key.split(".").pop() ?? "")) throw new PermissionError();
    const files = await storage();
    if (!(await files.exists(key))) throw new UserError("upload_missing");
    await db.update(albums).set({ musicKey: key }).where(eq(albums.id, albumId));
    // A song in another format would otherwise leave the old file behind.
    if (album.musicKey && album.musicKey !== key) {
      await files.remove(album.musicKey).catch((error) => console.warn(`Couldn't remove the old music ${album.musicKey}`, error));
    }
    revalidatePath(`/albums/${albumId}`);
    return null;
  });
}

export async function removeAlbumMusic(albumId: string) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const [album] = await db.select({ musicKey: albums.musicKey }).from(albums).where(eq(albums.id, albumId)).limit(1);
    if (album?.musicKey) await (await storage()).remove(album.musicKey);
    await db.update(albums).set({ musicKey: null }).where(eq(albums.id, albumId));
    revalidatePath(`/albums/${albumId}`);
    return null;
  });
}
