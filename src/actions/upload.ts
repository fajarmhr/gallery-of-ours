"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { processMedia } from "@/lib/media-processing";
import { assertCanEditAlbum, isAdmin, isAlbumLocked, PermissionError } from "@/lib/permissions";
import { actionUser } from "@/lib/session";
import { extensionFor, mediaKeys, storage } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024 * 1024;

const UploadItem = z.object({
  clientId: z.string().max(64),
  name: z.string().min(1).max(255),
  mime: z.string().max(100),
  size: z.number().int().positive().max(MAX_BYTES),
  type: z.enum(["photo", "video"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSec: z.number().nonnegative().nullable(),
  takenAt: z.string().max(40).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  thumbhash: z.string().max(200).nullable(),
  hasDisplay: z.boolean(),
  hasPoster: z.boolean(),
});

export type UploadItemInput = z.input<typeof UploadItem>;

export type UploadTarget = { url: string; headers: Record<string, string> };

export async function startUploads(albumId: string, rawItems: UploadItemInput[]) {
  return run(async () => {
    const current = await actionUser();
    await assertCanEditAlbum(current, albumId);
    const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!album || album.deletedAt) throw new UserError("album_missing");
    if (isAlbumLocked(album, current.id)) throw new PermissionError();
    if (rawItems.length === 0 || rawItems.length > 200) throw new UserError("too_many_files");

    const parsed = z.array(UploadItem).safeParse(rawItems);
    if (!parsed.success) throw new UserError("invalid_input");

    const files = await storage();
    const results: { clientId: string; mediaId: string; original: UploadTarget; display?: UploadTarget; poster?: UploadTarget }[] = [];

    for (const item of parsed.data) {
      const isImage = item.mime.startsWith("image/") || /\.(heic|heif)$/i.test(item.name);
      const isVideo = item.mime.startsWith("video/");
      if ((item.type === "photo" && !isImage) || (item.type === "video" && !isVideo)) throw new UserError("unsupported_file");

      const id = crypto.randomUUID();
      const keys = mediaKeys(id);
      const originalKey = keys.original(extensionFor(item.name, item.mime));
      const mime = item.mime || "application/octet-stream";
      const takenAt = item.takenAt && !Number.isNaN(Date.parse(item.takenAt)) ? new Date(item.takenAt) : null;

      await db.insert(media).values({
        id,
        albumId,
        uploaderId: current.id,
        type: item.type,
        status: "uploading",
        originalKey,
        originalName: item.name,
        mime,
        sizeBytes: item.size,
        displayKey: item.hasDisplay ? keys.display : null,
        posterKey: item.hasPoster ? keys.poster : null,
        width: item.width,
        height: item.height,
        durationSec: item.durationSec,
        thumbhash: item.thumbhash,
        takenAt,
        lat: item.lat,
        lng: item.lng,
      });

      results.push({
        clientId: item.clientId,
        mediaId: id,
        original: await files.presignPut(originalKey, mime, 6 * 3600),
        display: item.hasDisplay ? await files.presignPut(keys.display, "image/jpeg") : undefined,
        poster: item.hasPoster ? await files.presignPut(keys.poster, "image/jpeg") : undefined,
      });
    }
    return results;
  });
}

export async function finishUpload(mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!item) throw new UserError("not_found");
    if (item.uploaderId !== current.id && !isAdmin(current)) throw new PermissionError();

    const files = await storage();
    const required = [item.originalKey, item.displayKey, item.posterKey].filter((k): k is string => Boolean(k));
    for (const key of required) {
      if (!(await files.exists(key))) throw new UserError("upload_missing");
    }

    await db.update(media).set({ status: "processing" }).where(eq(media.id, mediaId));
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
    await (await storage()).removePrefix(mediaKeys(mediaId).prefix);
    await db.delete(media).where(eq(media.id, mediaId));
    return null;
  });
}
