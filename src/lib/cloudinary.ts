import { v2 as cloudinary } from "cloudinary";
import type { media } from "@/db/schema";
import { env, type CloudinaryAccount } from "@/lib/env";
import type { VariantName } from "@/lib/storage";

const PREFIX = "cloudinary:";
/** Same sizes as the R2 variants built in media-processing. */
const SIZES: Record<VariantName, number> = { thumb: 480, medium: 1280, large: 2400 };
/** Resized versions are WebP; originals keep their own format. */
const DERIVED_FORMAT = "webp";

type MediaRow = typeof media.$inferSelect;
export type CloudinaryItem = Pick<MediaRow, "source" | "originalKey" | "originalName" | "type">;
export type CloudinaryResourceType = "image" | "video";
export type CloudinaryAccountOption = { id: string; label: string };
export type CloudinaryFolder = { name: string; path: string };
export type CloudinaryAsset = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  name: string;
  width: number | null;
  height: number | null;
  /** Already authenticated in Cloudinary, which the app does when it imports an asset. */
  isPrivate: boolean;
  previewUrl: string;
};

type ListedResource = { public_id: string; resource_type: string; type: string; width?: number; height?: number; display_name?: string };

/** The SDK rejects with plain objects; this keeps the HTTP status so actions can explain the problem. */
export class CloudinaryError extends Error {
  constructor(
    message: string,
    public httpCode: number | null,
  ) {
    super(message);
    this.name = "CloudinaryError";
  }
}

async function call<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CloudinaryError) throw error;
    const detail = (error ?? {}) as { error?: { message?: string; http_code?: number }; message?: string; http_code?: number };
    throw new CloudinaryError(detail.error?.message ?? detail.message ?? String(error), detail.error?.http_code ?? detail.http_code ?? null);
  }
}

export const isCloudinarySource = (source: string) => source.startsWith(PREFIX);
export const cloudinarySource = (cloudName: string) => `${PREFIX}${cloudName}`;

export const cloudinaryAccountOptions = (): CloudinaryAccountOption[] =>
  env.cloudinary.map((account, index) => ({ id: account.cloudName, label: `Cloudinary ${index + 1} · ${account.cloudName}` }));

function accountFor(cloudName: string) {
  const account = env.cloudinary.find((a) => a.cloudName === cloudName);
  if (!account) throw new CloudinaryError(`Cloudinary account "${cloudName}" is not configured`, 401);
  return account;
}

const credentials = (account: CloudinaryAccount) => ({
  cloud_name: account.cloudName,
  api_key: account.apiKey,
  api_secret: account.apiSecret,
  secure: true,
});

const resourceTypeOf = (item: Pick<MediaRow, "type">): CloudinaryResourceType => (item.type === "video" ? "video" : "image");
const formatOf = (item: Pick<MediaRow, "originalName" | "type">) =>
  item.originalName?.split(".").pop()?.toLowerCase() || (item.type === "video" ? "mp4" : "jpg");

/** A still fitted inside size × size (a video's first frame). Must match between the eager list and delivery URLs. */
const stillTransformation = (size: number, video: boolean) => ({
  ...(video ? { start_offset: "0" } : {}),
  width: size,
  height: size,
  crop: "limit" as const,
  quality: "auto",
});

/* ───────────── Delivery ───────────── */

/** Signed URL for an imported (authenticated) asset. `variant` is thumb, medium, large, poster, original or download. */
export function cloudinaryDeliveryUrl(item: CloudinaryItem, variant: string) {
  const account = accountFor(item.source.slice(PREFIX.length));
  const options = { ...credentials(account), resource_type: resourceTypeOf(item), type: "authenticated" as const };

  if (variant === "download") {
    const downloadOptions = { ...options, attachment: true, expires_at: Math.floor(Date.now() / 1000) + 7200 };
    return cloudinary.utils.private_download_url(item.originalKey, formatOf(item), downloadOptions);
  }
  if (variant === "original") {
    return cloudinary.url(item.originalKey, { ...options, sign_url: true, format: formatOf(item) });
  }
  const size = SIZES[variant as VariantName] ?? SIZES.large;
  return cloudinary.url(item.originalKey, {
    ...options,
    sign_url: true,
    format: DERIVED_FORMAT,
    transformation: [stillTransformation(size, item.type === "video")],
  });
}

export async function fetchCloudinaryFile(item: CloudinaryItem, variant: VariantName | "original") {
  const response = await fetch(cloudinaryDeliveryUrl(item, variant), { cache: "no-store" });
  if (!response.ok) throw new CloudinaryError(`Cloudinary returned ${response.status} for ${item.originalKey} (${variant})`, response.status);
  return Buffer.from(await response.arrayBuffer());
}

export async function destroyCloudinaryMedia(item: CloudinaryItem) {
  const account = accountFor(item.source.slice(PREFIX.length));
  const options = { ...credentials(account), resource_type: resourceTypeOf(item), type: "authenticated" as const, invalidate: true };
  const result = await call(() => cloudinary.uploader.destroy(item.originalKey, options));
  if (result?.result !== "ok" && result?.result !== "not found") {
    throw new CloudinaryError(`Deleting ${item.originalKey} from Cloudinary returned "${result?.result}"`, null);
  }
}

/* ───────────── Browsing ───────────── */

const folderModes = new Map<string, "fixed" | "dynamic">();

async function folderMode(account: CloudinaryAccount) {
  let mode = folderModes.get(account.cloudName);
  if (!mode) {
    const config = await call(() => cloudinary.api.config({ ...credentials(account), settings: true }));
    mode = config.settings?.folder_mode === "fixed" ? "fixed" : "dynamic";
    folderModes.set(account.cloudName, mode);
  }
  return mode;
}

// The SDK types list root_folders(callback, options), but its v2 wrapper takes the options first.
const rootFolders = cloudinary.api.root_folders as unknown as (options: object) => Promise<{ folders?: CloudinaryFolder[] }>;

async function listResources(account: CloudinaryAccount, path: string) {
  const creds = credentials(account);
  const found: ListedResource[] = [];

  if ((await folderMode(account)) === "dynamic") {
    let cursor: string | undefined;
    do {
      const page = await call(() =>
        cloudinary.api.resources_by_asset_folder(path, { ...creds, max_results: 500, ...(cursor ? { next_cursor: cursor } : {}) }),
      );
      found.push(...(page.resources as unknown as ListedResource[]));
      cursor = page.next_cursor;
    } while (cursor);
    return found;
  }

  // Fixed folder mode: the folder is part of the public_id, so list by prefix and keep direct children.
  for (const resource_type of ["image", "video"] as const) {
    for (const type of ["upload", "authenticated"] as const) {
      let cursor: string | undefined;
      do {
        const page = await call(() =>
          cloudinary.api.resources({
            ...creds,
            resource_type,
            type,
            max_results: 500,
            ...(path ? { prefix: `${path}/` } : {}),
            ...(cursor ? { next_cursor: cursor } : {}),
          }),
        );
        const resources = page.resources as unknown as ListedResource[];
        found.push(...resources.filter((r) => !r.public_id.slice(path ? path.length + 1 : 0).includes("/")));
        cursor = page.next_cursor;
      } while (cursor);
    }
  }
  return found;
}

function previewUrl(account: CloudinaryAccount, resource: ListedResource, resourceType: CloudinaryResourceType) {
  const video = resourceType === "video";
  const options = { ...credentials(account), resource_type: resourceType, type: resource.type, sign_url: true };
  // Private assets only have the sizes generated at import; public ones can still be cropped on the fly.
  if (resource.type === "authenticated") {
    return cloudinary.url(resource.public_id, { ...options, format: DERIVED_FORMAT, transformation: [stillTransformation(SIZES.thumb, video)] });
  }
  return cloudinary.url(resource.public_id, {
    ...options,
    format: "jpg",
    transformation: [{ ...(video ? { start_offset: "0" } : {}), width: 240, height: 240, crop: "fill", quality: "auto" }],
  });
}

/** Sub-folders and the photos and videos directly inside `path` ("" is the top level). */
export async function listCloudinaryFolder(cloudName: string, path: string) {
  const account = accountFor(cloudName);
  const creds = credentials(account);
  const [folderPage, resources] = await Promise.all([
    call(() => (path ? cloudinary.api.sub_folders(path, { ...creds, max_results: 500 }) : rootFolders({ ...creds, max_results: 500 }))),
    listResources(account, path),
  ]);

  const folders: CloudinaryFolder[] = ((folderPage.folders ?? []) as CloudinaryFolder[]).map((folder) => ({ name: folder.name, path: folder.path }));
  const assets: CloudinaryAsset[] = [];
  for (const resource of resources) {
    const resourceType = resource.resource_type;
    if (resourceType !== "image" && resourceType !== "video") continue;
    if (resource.type !== "upload" && resource.type !== "authenticated") continue;
    assets.push({
      publicId: resource.public_id,
      resourceType,
      name: resource.display_name ?? resource.public_id,
      width: resource.width ?? null,
      height: resource.height ?? null,
      isPrivate: resource.type === "authenticated",
      previewUrl: previewUrl(account, resource, resourceType),
    });
  }
  return { folders, assets };
}

/* ───────────── Importing ───────────── */

/** Details of a public asset, with the date and place read from its embedded metadata when present. */
export async function readCloudinaryAsset(cloudName: string, publicId: string, resourceType: CloudinaryResourceType, timeZone: string) {
  const account = accountFor(cloudName);
  const resource = await call(() =>
    cloudinary.api.resource(publicId, { ...credentials(account), resource_type: resourceType, type: "upload", image_metadata: true, media_metadata: true }),
  );
  const metadata = (resource.image_metadata ?? resource.media_metadata ?? {}) as Record<string, unknown>;
  const format = String(resource.format ?? (resourceType === "video" ? "mp4" : "jpg")).toLowerCase();

  return {
    format,
    bytes: typeof resource.bytes === "number" ? resource.bytes : null,
    width: typeof resource.width === "number" ? resource.width : null,
    height: typeof resource.height === "number" ? resource.height : null,
    durationSec: typeof resource.duration === "number" ? resource.duration : null,
    originalName: `${resource.original_filename ?? resource.display_name ?? publicId.split("/").pop()}.${format}`,
    uploadedAt: new Date(resource.created_at),
    takenAt: takenAtFromMetadata(metadata, timeZone),
    ...gpsFromMetadata(metadata),
  };
}

/** Generates every size the app shows for an authenticated asset, because those can't be transformed on the fly. */
async function generateSizes(account: CloudinaryAccount, publicId: string, resourceType: CloudinaryResourceType) {
  const video = resourceType === "video";
  const result = await call(() =>
    cloudinary.uploader.explicit(publicId, {
      ...credentials(account),
      resource_type: resourceType,
      type: "authenticated",
      eager: Object.values(SIZES).map((size) => ({ ...stillTransformation(size, video), format: DERIVED_FORMAT })),
      eager_async: video,
    }),
  );
  return result as unknown as Record<string, unknown>;
}

/**
 * Switches a public asset to authenticated delivery (old public links stop working) and generates its sizes.
 * Reverts the switch if generating fails.
 */
export async function makeCloudinaryAssetPrivate(cloudName: string, publicId: string, resourceType: CloudinaryResourceType) {
  const account = accountFor(cloudName);
  const toPrivate = { ...credentials(account), resource_type: resourceType, type: "upload" as const, to_type: "authenticated" as const, invalidate: true };
  await call(() => cloudinary.uploader.rename(publicId, publicId, toPrivate));

  try {
    await generateSizes(account, publicId, resourceType);
  } catch (error) {
    const toPublic = { ...toPrivate, type: "authenticated" as const, to_type: "upload" as const };
    await call(() => cloudinary.uploader.rename(publicId, publicId, toPublic)).catch((undoError) =>
      console.error(`Could not make ${publicId} public again`, undoError),
    );
    throw error;
  }
}

/* ───────────── Uploading from the browser ───────────── */

/** Folder new uploads go into, so they're easy to find in the Cloudinary console. */
const UPLOAD_FOLDER = "gallery-of-ours";

export type CloudinaryUploadTarget = { url: string; fields: Record<string, string> };

/** Signed form fields for a private upload straight from the browser; the file never passes through our server. */
export function cloudinaryUploadTarget(cloudName: string, item: Pick<MediaRow, "id" | "type">): CloudinaryUploadTarget {
  const account = accountFor(cloudName);
  const params = { timestamp: String(Math.floor(Date.now() / 1000)), public_id: item.id, folder: UPLOAD_FOLDER, type: "authenticated" };
  return {
    url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(account.cloudName)}/${resourceTypeOf(item)}/upload`,
    fields: { ...params, api_key: account.apiKey, signature: cloudinary.utils.api_sign_request(params, account.apiSecret) },
  };
}

/**
 * Confirms a browser upload arrived (Cloudinary answers 404 when it didn't) and generates its sizes. The public_id must be
 * the one that was signed, with or without the upload folder in front, which depends on the account's folder mode.
 */
export async function finishCloudinaryUpload(item: Pick<MediaRow, "id" | "source" | "type">, publicId: string) {
  if (publicId !== item.id && publicId !== `${UPLOAD_FOLDER}/${item.id}`) {
    throw new CloudinaryError(`Upload for ${item.id} came back as "${publicId}"`, 400);
  }
  const result = await generateSizes(accountFor(item.source.slice(PREFIX.length)), publicId, resourceTypeOf(item));
  const numberOf = (key: string) => (typeof result[key] === "number" ? (result[key] as number) : null);
  return { bytes: numberOf("bytes"), width: numberOf("width"), height: numberOf("height"), durationSec: numberOf("duration") };
}

/* ───────────── Metadata ───────────── */

/** Turns a wall-clock time like "2025-04-05T14:13:07" in `timeZone` into a Date. */
export function zonedTimeToDate(localIso: string, timeZone: string) {
  const guess = new Date(`${localIso}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(guess)
      .map((part) => [part.type, Number(part.value)]),
  );
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(guess.getTime() * 2 - shown);
}

const EXIF_DATE = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;
const UTC_OFFSET = /^[+-]\d{2}:?\d{2}$/;

/** Parses EXIF/XMP dates such as "2025:04:05 14:13:07" or "2025:04:05 14:13:07.00+07:00". */
function metadataDate(value: unknown, offset: unknown, timeZone: string) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(EXIF_DATE);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const local = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const fixed = zone ?? (typeof offset === "string" && UTC_OFFSET.test(offset.trim()) ? offset.trim() : undefined);
  if (!fixed) return zonedTimeToDate(local, timeZone);
  const date = new Date(`${local}${fixed === "Z" || fixed.includes(":") ? fixed : `${fixed.slice(0, 3)}:${fixed.slice(3)}`}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function takenAtFromMetadata(metadata: Record<string, unknown>, timeZone: string) {
  return (
    metadataDate(metadata.DateTimeOriginal, metadata.OffsetTimeOriginal, timeZone) ??
    metadataDate(metadata.DateCreated, undefined, timeZone) ??
    metadataDate(metadata.CreateDate, metadata.OffsetTimeDigitized, timeZone)
  );
}

/** Reads "7 deg 15' 31.20\" S", "7.2587 S" or plain decimal coordinates. */
function coordinate(value: unknown, ref: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  const [degrees = 0, minutes = 0, seconds = 0] = numbers;
  const magnitude = degrees + minutes / 60 + seconds / 3600;
  const hemisphere = `${typeof ref === "string" ? ref : ""} ${value}`.match(/\b(N|S|E|W|North|South|East|West)\b/i)?.[1]?.charAt(0).toUpperCase();
  return value.trim().startsWith("-") || hemisphere === "S" || hemisphere === "W" ? -magnitude : magnitude;
}

function gpsFromMetadata(metadata: Record<string, unknown>) {
  const lat = coordinate(metadata.GPSLatitude, metadata.GPSLatitudeRef);
  const lng = coordinate(metadata.GPSLongitude, metadata.GPSLongitudeRef);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return { lat: null, lng: null };
  return { lat, lng };
}
