import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { cloudinaryFolderMode, destroyCloudinaryMedia, isCloudinarySource, moveCloudinaryAsset } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { extensionFor, mediaKeys, ROOT_FOLDER, storage } from "@/lib/storage";

/*
 * Album folders: originals are filed as "gallery-of-ours/<album title>/<YYYY-MM-DD HH.mm original name>.<ext>" in R2 (the
 * object key) and in Cloudinary (asset folder + display name; the public_id stays the media id so links never change).
 * Files follow their album when it's renamed or when they move to another album. Sizes the app makes stay at media/<id>/.
 */

type MediaRow = typeof media.$inferSelect;
type AlbumRow = typeof albums.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** What a stored original is named after. */
export type Naming = Pick<MediaRow, "id" | "takenAt" | "originalName" | "mime">;
type FileParts = { base: string; ext: string };

const FALLBACK_ALBUM = "Album";
const STORY_MUSIC = "Story music";

/** Safe as a folder or file name in R2, Cloudinary and a Windows folder: no slashes, reserved or control characters. */
export function cleanName(text: string, fallback: string) {
  const cleaned = text
    .normalize("NFC")
    .replace(/[\\/:*?"<>|#%&]/g, " ")
    .replace(/\p{Cc}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 100)
    .trim()
    .replace(/\.+$/, "");
  return cleaned || fallback;
}

/** An album's folder: its title, plus the start of its id when an older album already uses the same name. */
export async function albumFolder(album: Pick<AlbumRow, "id" | "title" | "createdAt">) {
  const name = cleanName(album.title, FALLBACK_ALBUM);
  const others = await db.select({ id: albums.id, title: albums.title, createdAt: albums.createdAt }).from(albums).where(ne(albums.id, album.id));
  const clash = others.some(
    (other) =>
      (other.createdAt < album.createdAt || (other.createdAt.getTime() === album.createdAt.getTime() && other.id < album.id)) &&
      cleanName(other.title, FALLBACK_ALBUM).toLowerCase() === name.toLowerCase(),
  );
  return clash ? `${name} (${album.id.slice(0, 4)})` : name;
}

export const folderPath = (folder: string) => `${ROOT_FOLDER}/${folder}`;
export const musicPath = (folder: string, ext: string) => `${folderPath(folder)}/${STORY_MUSIC}.${ext}`;
/** "2024-08-17 18.32 IMG_2041 (2)" from a stored path: what Cloudinary shows as the asset's name. */
export const displayNameOf = (path: string) => (path.split("/").pop() ?? path).replace(/\.[^.]*$/, "");

/** "2024-08-17 18.32 IMG_2041" in the family's time zone, or just the original name when the date is unknown. */
function fileParts(item: Naming): FileParts {
  const name = cleanName((item.originalName ?? "").replace(/\.[^.]*$/, ""), item.id.slice(0, 8));
  const ext = extensionFor(item.originalName ?? "", item.mime);
  if (!item.takenAt) return { base: name, ext };
  const part = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: env.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(item.takenAt)
      .map((p) => [p.type, p.value]),
  );
  return { base: `${part.year}-${part.month}-${part.day} ${part.hour}.${part.minute} ${name}`, ext };
}

/** Whether `path` is this file's name in this folder, including a " (2)" it was given to avoid a clash. */
function fitsName(path: string, folder: string, { base, ext }: FileParts) {
  const stem = `${folderPath(folder)}/${base}`;
  if (path === `${stem}.${ext}`) return true;
  const counter = path.startsWith(`${stem} (`) && path.endsWith(`).${ext}`) ? path.slice(stem.length + 2, path.length - ext.length - 2) : "";
  return /^\d+$/.test(counter);
}

/**
 * Reserves the first free "<name>.<ext>", "<name> (2).<ext>", … in an album folder and saves it with `write` in the same
 * transaction. An advisory lock on the path stops two uploads from taking the same name at the same moment.
 */
export async function claimPath(source: string, folder: string, item: Naming, write: (tx: Transaction, path: string) => PromiseLike<unknown>) {
  const parts = fileParts(item);
  for (let n = 1; n <= 500; n++) {
    const path = `${folderPath(folder)}/${parts.base}${n > 1 ? ` (${n})` : ""}.${parts.ext}`;
    const claimed = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${source}|${path}`}))`);
      const [taken] = await tx
        .select({ id: media.id })
        .from(media)
        .where(and(eq(media.source, source), eq(media.storagePath, path), ne(media.id, item.id)))
        .limit(1);
      if (taken) return false;
      await write(tx, path);
      return true;
    });
    if (claimed) return path;
  }
  throw new Error(`No free file name for "${parts.base}" in "${folder}"`);
}

/**
 * Files one original into its album folder under its date name (keeping a " (2)" it already has). R2 files are copied, then
 * the old copy removed; Cloudinary assets only get a new asset folder and display name. Photos imported from existing
 * Cloudinary folders and accounts in fixed folder mode are left alone. Returns whether anything moved.
 */
export async function organizeMedia(item: MediaRow, folder: string) {
  if (item.status === "uploading") return false;
  const cloud = isCloudinarySource(item.source);
  if (cloud) {
    const appUpload = item.originalKey === item.id || item.originalKey === `${ROOT_FOLDER}/${item.id}`;
    if (!appUpload || (await cloudinaryFolderMode(item.source)) !== "dynamic") return false;
  }
  const settled = item.storagePath !== null && fitsName(item.storagePath, folder, fileParts(item));
  if (settled && (cloud || item.originalKey === item.storagePath)) return false;

  const path = settled
    ? item.storagePath!
    : await claimPath(item.source, folder, item, (tx, candidate) => tx.update(media).set({ storagePath: candidate }).where(eq(media.id, item.id)));
  try {
    if (cloud) {
      await moveCloudinaryAsset(item, folderPath(folder), displayNameOf(path));
    } else {
      const files = await storage();
      await files.copy(item.originalKey, path);
      await db.update(media).set({ originalKey: path }).where(eq(media.id, item.id));
      await files.remove(item.originalKey).catch((error) => console.warn(`Couldn't remove the old copy ${item.originalKey}`, error));
    }
  } catch (error) {
    if (!settled) await db.update(media).set({ storagePath: item.storagePath }).where(eq(media.id, item.id));
    throw error;
  }
  return true;
}

/** Brings an album's stored files, story music included, in line with its current folder. Safe to run again. */
export async function organizeAlbum(albumId: string) {
  const result = { folder: "", moved: 0, failed: 0 };
  const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album) return result;
  const folder = await albumFolder(album);
  result.folder = folder;

  for (const item of await db.select().from(media).where(eq(media.albumId, albumId))) {
    try {
      if (await organizeMedia(item, folder)) result.moved += 1;
    } catch (error) {
      result.failed += 1;
      console.warn(`Couldn't file ${item.id} into "${folder}"`, error);
    }
  }

  const target = album.musicKey ? musicPath(folder, album.musicKey.split(".").pop() ?? "mp3") : null;
  if (album.musicKey && target && album.musicKey !== target) {
    try {
      const files = await storage();
      await files.copy(album.musicKey, target);
      await db.update(albums).set({ musicKey: target }).where(eq(albums.id, album.id));
      await files.remove(album.musicKey);
      result.moved += 1;
    } catch (error) {
      result.failed += 1;
      console.warn(`Couldn't file the story music of ${album.id} into "${folder}"`, error);
    }
  }
  return result;
}

/** Deletes an item's stored files: the Cloudinary asset, or in R2 the original (wherever it's filed) and the app-made sizes. */
export async function removeStoredMedia(item: Pick<MediaRow, "id" | "source" | "originalKey" | "originalName" | "type">) {
  if (isCloudinarySource(item.source)) return destroyCloudinaryMedia(item);
  const files = await storage();
  const sizes = mediaKeys(item.id).prefix;
  if (!item.originalKey.startsWith(sizes)) await files.remove(item.originalKey);
  await files.removePrefix(sizes);
}
