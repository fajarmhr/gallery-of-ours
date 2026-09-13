import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { db } from "@/db";
import { albums, media, type MediaVariants } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { captionImage } from "@/lib/ai";
import { fetchCloudinaryFile, isCloudinarySource } from "@/lib/cloudinary";
import { findOrCreatePlace } from "@/lib/geocode";
import { mediaKeys, storage, type VariantName } from "@/lib/storage";

const SIZES: Record<VariantName, number> = { thumb: 480, medium: 1280, large: 2400 };

type MediaRow = typeof media.$inferSelect;
type Prepared = {
  variants: MediaVariants;
  width: number | null;
  height: number | null;
  thumbhash: string | null;
  /** Loads a WebP around 1280px for the AI caption, when there is one. */
  captionSource: (() => Promise<Buffer>) | null;
};

/** R2 or local storage: builds web-sized WebP versions next to the original. */
async function prepareStored(item: MediaRow): Promise<Prepared> {
  const files = await storage();
  const sourceKey = item.type === "video" ? item.posterKey : (item.displayKey ?? item.originalKey);
  const variants: MediaVariants = {};
  let { width, height } = item;

  if (sourceKey) {
    const input = await files.getBuffer(sourceKey);
    if (item.type === "photo" && (!width || !height)) {
      const meta = await sharp(input, { failOn: "none" }).metadata();
      const rotated = (meta.orientation ?? 1) >= 5;
      width = (rotated ? meta.height : meta.width) ?? null;
      height = (rotated ? meta.width : meta.height) ?? null;
    }
    for (const name of Object.keys(SIZES) as VariantName[]) {
      const { data, info } = await sharp(input, { failOn: "none" })
        .rotate()
        .resize({ width: SIZES[name], height: SIZES[name], fit: "inside", withoutEnlargement: true })
        .webp({ quality: name === "thumb" ? 70 : 80 })
        .toBuffer({ resolveWithObject: true });
      const key = mediaKeys(item.id).variant(name);
      await files.put(key, data, "image/webp");
      variants[name] = { key, width: info.width, height: info.height };
    }
  }

  const medium = variants.medium;
  return { variants, width, height, thumbhash: item.thumbhash, captionSource: medium ? () => files.getBuffer(medium.key) : null };
}

/** Cloudinary: its sizes were generated at import, so only the blur placeholder is made here. */
async function prepareCloudinary(item: MediaRow): Promise<Prepared> {
  const thumbhash =
    item.thumbhash ??
    (await fetchCloudinaryFile(item, "thumb")
      .then(thumbhashOf)
      .catch((error) => {
        console.warn(`Thumbhash skipped for ${item.id}`, error);
        return null;
      }));
  return { variants: {}, width: item.width, height: item.height, thumbhash, captionSource: () => fetchCloudinaryFile(item, "medium") };
}

async function thumbhashOf(image: Buffer) {
  const { data, info } = await sharp(image, { failOn: "none" })
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");
}

/** Builds web-sized versions, resolves the place and asks AI for a caption. Runs after the upload or import response. */
export async function processMedia(mediaId: string, options: { skipAI?: boolean } = {}) {
  const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!item) return;

  try {
    const prepared = isCloudinarySource(item.source) ? await prepareCloudinary(item) : await prepareStored(item);

    let placeId = item.placeId;
    if (!placeId && item.lat != null && item.lng != null) {
      placeId = await findOrCreatePlace(item.lat, item.lng).catch(() => null);
    }

    await db
      .update(media)
      .set({ variants: prepared.variants, width: prepared.width, height: prepared.height, thumbhash: prepared.thumbhash, placeId, status: "ready" })
      .where(eq(media.id, item.id));
    await db
      .update(albums)
      .set({ coverMediaId: item.id })
      .where(and(eq(albums.id, item.albumId), isNull(albums.coverMediaId)));

    if (!options.skipAI && prepared.captionSource) {
      try {
        const result = await captionImage(await prepared.captionSource());
        if (result) {
          await db.update(media).set({ aiCaption: result.caption, aiTags: result.tags }).where(eq(media.id, item.id));
          await logActivity(null, "ai.caption", "media", item.id);
        }
      } catch (error) {
        console.warn(`AI caption skipped for ${item.id}`, error);
      }
    }
  } catch (error) {
    console.error(`Processing media ${mediaId} failed`, error);
    await db.update(media).set({ status: "failed" }).where(eq(media.id, mediaId));
  }
}
