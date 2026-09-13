import { hasR2 } from "@/lib/env";

export interface StorageDriver {
  name: "r2" | "local";
  presignPut(key: string, contentType: string, expiresInSec?: number): Promise<{ url: string; headers: Record<string, string> }>;
  /** May return a relative URL for the local driver. */
  presignGet(key: string, options?: { expiresInSec?: number; filename?: string }): Promise<string>;
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  getBuffer(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  removePrefix(prefix: string): Promise<void>;
}

let driver: StorageDriver | null = null;

export async function storage(): Promise<StorageDriver> {
  if (driver) return driver;
  if (hasR2()) {
    const { r2Driver } = await import("./r2");
    driver = r2Driver();
  } else {
    if (process.env.VERCEL) {
      throw new Error("Cloudflare R2 is not configured. Local file storage only works on your own computer.");
    }
    const { localDriver } = await import("./local");
    driver = localDriver();
  }
  return driver;
}

export type VariantName = "thumb" | "medium" | "large";

export const mediaKeys = (mediaId: string) => ({
  prefix: `media/${mediaId}/`,
  original: (ext: string) => `media/${mediaId}/original.${ext}`,
  display: `media/${mediaId}/display.jpg`,
  poster: `media/${mediaId}/poster.jpg`,
  variant: (name: VariantName) => `media/${mediaId}/${name}.webp`,
});

export const albumMusicKey = (albumId: string, ext: string) => `albums/${albumId}/music.${ext}`;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export function extensionFor(filename: string, mime: string) {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return EXT_BY_MIME[mime] ?? "bin";
}
