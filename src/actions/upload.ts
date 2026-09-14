"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import {
  CloudinaryError,
  cloudinaryFolderMode,
  cloudinarySource,
  cloudinaryUploadTarget,
  finishCloudinaryUpload,
  isCloudinarySource,
  type CloudinaryUploadTarget,
} from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { processMedia } from "@/lib/media-processing";
import { assertCanEditAlbum, isAdmin, isAlbumLocked, PermissionError } from "@/lib/permissions";
import { actionUser } from "@/lib/session";
import { mediaKeys, storage } from "@/lib/storage";
import { albumFolder, claimPath, displayNameOf, folderPath, removeStoredMedia } from "@/lib/storage-layout";

/** A single presigned PUT to R2 can carry up to 5 GB. */
const MAX_BYTES = 5 * 1024 * 1024 * 1024;

/** Details read in the browser are best guesses: one that doesn't fit becomes null instead of failing the upload. */
const guess = <T extends z.ZodType>(schema: T) =>
  z.unknown().transform((value): z.output<T> | null => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });

const UploadItem = z.object({
  clientId: z.string().max(64),
  name: z
    .string()
    .min(1)
    .max(1000)
    .transform((value) => value.slice(0, 255)),
  mime: z.string().max(100),
  size: z.number().int().positive().max(MAX_BYTES),
  type: z.enum(["photo", "video"]),
  width: guess(z.number().int().positive()),
  height: guess(z.number().int().positive()),
  durationSec: guess(z.number().nonnegative()),
  takenAt: guess(z.string().max(40).refine((value) => !Number.isNaN(Date.parse(value)))),
  lat: guess(z.number().min(-90).max(90)),
  lng: guess(z.number().min(-180).max(180)),
  thumbhash: guess(z.string().max(200)),
  hasDisplay: z.boolean(),
  hasPoster: z.boolean(),
});

export type UploadItemInput = z.input<typeof UploadItem>;

export type UploadTarget = { url: string; headers: Record<string, string> };

export type StartedUpload = {
  clientId: string;
  mediaId: string;
  /** R2: presigned PUTs for the file and the JPEGs made in the browser. */
  original?: UploadTarget;
  display?: UploadTarget;
  poster?: UploadTarget;
  /** Cloudinary: a signed form to POST the file to. */
  cloudinary?: CloudinaryUploadTarget;
};

/** `storageId` is "primary" (R2) or the cloud name of a configured Cloudinary account. Originals are filed in the album's folder. */
export async function startUploads(albumId: string, rawItems: UploadItemInput[], storageId = "primary") {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!album || album.deletedAt) throw new UserError("album_missing");
    if (isAlbumLocked(album, current.id)) throw new PermissionError();
    if (rawItems.length === 0 || rawItems.length > 200) throw new UserError("too_many_files");
    const cloudName = storageId === "primary" ? null : (env.cloudinary.find((account) => account.cloudName === storageId)?.cloudName ?? null);
    if (storageId !== "primary" && !cloudName) throw new UserError("storage_unavailable");

    const parsed = z.array(UploadItem).safeParse(rawItems);
    if (!parsed.success) {
      console.warn("Upload details rejected", JSON.stringify(parsed.error.issues));
      throw new UserError("invalid_input");
    }

    const files = cloudName ? null : await storage();
    const source = cloudName ? cloudinarySource(cloudName) : "primary";
    // Cloudinary accounts in the old fixed folder mode can't file assets into folders without changing their links.
    const folder = cloudName && (await cloudinaryFolderMode(cloudName)) !== "dynamic" ? null : await albumFolder(album);
    const results: StartedUpload[] = [];

    for (const item of parsed.data) {
      const isImage = item.mime.startsWith("image/") || /\.(heic|heif)$/i.test(item.name);
      const isVideo = item.mime.startsWith("video/");
      if ((item.type === "photo" && !isImage) || (item.type === "video" && !isVideo)) throw new UserError("unsupported_file");

      const id = crypto.randomUUID();
      const mime = item.mime || "application/octet-stream";
      const hasGps = item.lat !== null && item.lng !== null;
      const row = {
        id,
        albumId,
        uploaderId: current.id,
        type: item.type,
        status: "uploading",
        originalName: item.name,
        mime,
        sizeBytes: item.size,
        width: item.width,
        height: item.height,
        durationSec: item.durationSec,
        thumbhash: item.thumbhash,
        takenAt: item.takenAt ? new Date(item.takenAt) : null,
        lat: hasGps ? item.lat : null,
        lng: hasGps ? item.lng : null,
      };
      const naming = { id, takenAt: row.takenAt, originalName: item.name, mime };

      if (cloudName) {
        // Cloudinary makes its own sizes and video stills, so the JPEGs made in the browser aren't sent.
        const values = { ...row, source, originalKey: id };
        if (!folder) {
          await db.insert(media).values(values);
          results.push({ clientId: item.clientId, mediaId: id, cloudinary: cloudinaryUploadTarget(cloudName, { id, type: item.type }) });
          continue;
        }
        const path = await claimPath(source, folder, naming, (tx, storagePath) => tx.insert(media).values({ ...values, storagePath }));
        results.push({
          clientId: item.clientId,
          mediaId: id,
          cloudinary: cloudinaryUploadTarget(cloudName, { id, type: item.type }, { folder: folderPath(folder), displayName: displayNameOf(path) }),
        });
        continue;
      }

      const store = files ?? (await storage());
      const keys = mediaKeys(id);
      const originalKey = await claimPath(source, folder!, naming, (tx, path) =>
        tx.insert(media).values({
          ...row,
          originalKey: path,
          storagePath: path,
          displayKey: item.hasDisplay ? keys.display : null,
          posterKey: item.hasPoster ? keys.poster : null,
        }),
      );
      results.push({
        clientId: item.clientId,
        mediaId: id,
        original: await store.presignPut(originalKey, mime, 6 * 3600),
        display: item.hasDisplay ? await store.presignPut(keys.display, "image/jpeg") : undefined,
        poster: item.hasPoster ? await store.presignPut(keys.poster, "image/jpeg") : undefined,
      });
    }
    return results;
  });
}

const CloudinaryUpload = z.object({ publicId: z.string().min(1).max(300) });

/** Checks the files arrived and starts processing. Cloudinary uploads pass the public_id Cloudinary answered with. */
export async function finishUpload(mediaId: string, uploaded?: z.input<typeof CloudinaryUpload>) {
  return run(async () => {
    const current = await actionUser();
    const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!item) throw new UserError("not_found");
    if (item.uploaderId !== current.id && !isAdmin(current)) throw new PermissionError();

    if (isCloudinarySource(item.source)) {
      const parsed = CloudinaryUpload.safeParse(uploaded);
      if (!parsed.success) throw new UserError("upload_missing");
      const details = await finishCloudinaryUpload(item, parsed.data.publicId).catch((error: unknown) => {
        if (error instanceof CloudinaryError && (error.httpCode === 400 || error.httpCode === 404)) throw new UserError("upload_missing");
        throw error;
      });
      await db
        .update(media)
        .set({
          originalKey: parsed.data.publicId,
          sizeBytes: details.bytes ?? item.sizeBytes,
          width: item.width ?? details.width,
          height: item.height ?? details.height,
          durationSec: item.durationSec ?? details.durationSec,
          status: "processing",
        })
        .where(eq(media.id, mediaId));
    } else {
      const files = await storage();
      const required = [item.originalKey, item.displayKey, item.posterKey].filter((k): k is string => Boolean(k));
      for (const key of required) {
        if (!(await files.exists(key))) throw new UserError("upload_missing");
      }
      await db.update(media).set({ status: "processing" }).where(eq(media.id, mediaId));
    }

    after(() => processMedia(mediaId));
    await logActivity(current.id, "media.upload", "media", mediaId, { albumId: item.albumId });
    revalidatePath(`/albums/${item.albumId}`);
    return null;
  });
}

export async function cancelUpload(mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!item) return null;
    if (item.uploaderId !== current.id && !isAdmin(current)) throw new PermissionError();
    if (item.status !== "uploading") return null;
    await removeStoredMedia(item).catch((error) => console.warn(`Couldn't remove the cancelled upload ${mediaId}`, error));
    await db.delete(media).where(eq(media.id, mediaId));
    return null;
  });
}
