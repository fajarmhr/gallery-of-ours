"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import {
  CloudinaryError,
  cloudinarySource,
  listCloudinaryFolder,
  makeCloudinaryAssetPrivate,
  readCloudinaryAsset,
  zonedTimeToDate,
} from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { processMedia } from "@/lib/media-processing";
import { assertAdmin, isAlbumLocked, PermissionError } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

/** Cloudinary problems an admin can act on get their own message; anything else is logged by `run`. */
function explainCloudinaryError(error: unknown): never {
  if (error instanceof CloudinaryError) {
    if (error.httpCode === 401 || error.httpCode === 403) throw new UserError("cloudinary_unavailable");
    if (error.httpCode === 404) throw new UserError("not_found");
  }
  throw error;
}

export async function browseCloudinaryFolder(accountId: string, path: string) {
  return run(async () => {
    assertAdmin(await actionUser());
    const listing = await listCloudinaryFolder(accountId, path).catch(explainCloudinaryError);

    const publicIds = listing.assets.map((asset) => asset.publicId);
    const imported = publicIds.length
      ? await db
          .select({ publicId: media.originalKey })
          .from(media)
          .where(and(eq(media.source, cloudinarySource(accountId)), inArray(media.originalKey, publicIds)))
      : [];
    const importedIds = new Set(imported.map((row) => row.publicId));

    return { folders: listing.folders, assets: listing.assets.map((asset) => ({ ...asset, added: importedIds.has(asset.publicId) })) };
  });
}

const ImportInput = z.object({
  albumId: z.string().max(64),
  accountId: z.string().min(1).max(100),
  publicId: z.string().min(1).max(500),
  resourceType: z.enum(["image", "video"]),
  fallbackDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

/** Adds one Cloudinary asset to an album. The file stays in Cloudinary and becomes private there. */
export async function importFromCloudinary(input: z.input<typeof ImportInput>) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const parsed = ImportInput.safeParse(input);
    if (!parsed.success) throw new UserError("invalid_input");
    const { albumId, accountId, publicId, resourceType, fallbackDate } = parsed.data;

    const [album] = await db.select().from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!album || album.deletedAt) throw new UserError("album_missing");
    if (isAlbumLocked(album, current.id)) throw new PermissionError();

    const source = cloudinarySource(accountId);
    const [existing] = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.source, source), eq(media.originalKey, publicId)))
      .limit(1);
    if (existing) throw new UserError("already_imported");

    const asset = await readCloudinaryAsset(accountId, publicId, resourceType, env.timeZone).catch(explainCloudinaryError);
    const fallback = fallbackDate ? zonedTimeToDate(`${fallbackDate}T12:00:00`, env.timeZone) : null;
    const video = resourceType === "video";
    const id = crypto.randomUUID();

    await db.insert(media).values({
      id,
      albumId,
      uploaderId: current.id,
      type: video ? "video" : "photo",
      status: "processing",
      source,
      originalKey: publicId,
      originalName: asset.originalName,
      mime: video ? `video/${asset.format === "mov" ? "quicktime" : asset.format}` : `image/${asset.format === "jpg" ? "jpeg" : asset.format}`,
      sizeBytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      durationSec: asset.durationSec,
      takenAt: asset.takenAt ?? fallback ?? asset.uploadedAt,
      lat: asset.lat,
      lng: asset.lng,
    });

    try {
      await makeCloudinaryAssetPrivate(accountId, publicId, resourceType);
    } catch (error) {
      await db.delete(media).where(eq(media.id, id));
      explainCloudinaryError(error);
    }

    after(() => processMedia(id));
    await logActivity(current.id, "media.upload", "media", id, { albumId, from: "cloudinary" });
    revalidatePath(`/albums/${albumId}`);
    return { mediaId: id };
  });
}
