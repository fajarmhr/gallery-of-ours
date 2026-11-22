import exifr from "exifr";
import { rgbaToThumbHash } from "thumbhash";
import { mediaFileInfo } from "@/lib/media-file";

export type PreparedFile = {
  name: string;
  mime: string;
  size: number;
  type: "photo" | "video";
  width: number | null;
  height: number | null;
  durationSec: number | null;
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
  thumbhash: string | null;
  display: Blob | null;
  poster: Blob | null;
  previewUrl: string | null;
};

export const isHeicFile = (file: File) => mediaFileInfo(file.name, file.type).heic;
export const isSupportedFile = (file: File) => mediaFileInfo(file.name, file.type).type !== null;

const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The file's modified time, when the browser reports a real one. */
const modifiedAt = (file: File) => {
  const date = new Date(file.lastModified);
  return file.lastModified > 0 && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

/** Native decoding handles HEIC on current iPhones without loading a large WASM decoder. */
async function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const dispose = () => {
    image.onload = image.onerror = null;
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("image_decode_timeout")), 10_000);
      image.onload = () => {
        clearTimeout(timer);
        if (image.naturalWidth && image.naturalHeight) resolve();
        else reject(new Error("image_decode_failed"));
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("image_decode_failed"));
      };
      image.src = url;
    });
    return { image, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function thumbhashOf(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  try {
    const scale = 100 / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0, w, h);
    return toBase64(rgbaToThumbHash(w, h, context.getImageData(0, 0, w, h).data));
  } catch {
    return null;
  } finally {
    canvas.width = canvas.height = 1;
  }
}

/** Canvas surfaces stay bounded even for 48 MP photos and 4K/8K video. Originals are untouched. */
async function jpegOf(source: CanvasImageSource, width: number, height: number, maxEdge: number, quality = 0.88) {
  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  } catch {
    return null;
  } finally {
    canvas.width = canvas.height = 1;
  }
}

function readVideo(file: Blob): Promise<{ width: number | null; height: number | null; duration: number | null; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const meta = () => ({
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      duration: Number.isFinite(video.duration) ? video.duration : null,
    });
    const finish = (poster: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = { ...meta(), poster };
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 10_000);

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.5, (Number.isFinite(video.duration) ? video.duration : 1) / 3);
      } catch {
        finish(null);
      }
    };
    let capturing = false;
    const capture = () => {
      if (settled || capturing || video.seeking || !video.videoWidth || !video.videoHeight || video.readyState < 2) return;
      capturing = true;
      void jpegOf(video, video.videoWidth, video.videoHeight, 1280, 0.85).then(finish);
    };
    video.onloadeddata = capture;
    video.onseeked = capture;
    video.onerror = () => finish(null);
    video.src = url;
    video.load();
  });
}

/** Reads date, GPS and size, converts HEIC for browsers and builds a tiny blurred preview. */
export async function prepareFile(
  file: File,
  onStage?: (stage: "reading" | "converting") => void,
  options: { portableDisplay?: boolean } = {},
): Promise<PreparedFile> {
  onStage?.("reading");
  const info = mediaFileInfo(file.name, file.type);
  if (!info.type) throw new Error("unsupported_file");
  const heic = info.heic;
  // Files/iCloud sometimes supplies an empty MIME. Give decoders the same type we sign for storage.
  const typedFile = file.type === info.mime ? file : file.slice(0, file.size, info.mime);
  const base = {
    name: file.name,
    mime: info.mime,
    size: file.size,
  };

  if (info.type === "video") {
    const video = await readVideo(typedFile);
    let thumbhash: string | null = null;
    if (video.poster && video.width && video.height) {
      const decoded = await loadImage(video.poster).catch(() => null);
      if (decoded) {
        thumbhash = thumbhashOf(decoded.image, decoded.image.naturalWidth, decoded.image.naturalHeight);
        decoded.dispose();
      }
    }
    return {
      ...base,
      type: "video",
      width: video.width,
      height: video.height,
      durationSec: video.duration,
      takenAt: modifiedAt(file),
      lat: null,
      lng: null,
      thumbhash,
      display: null,
      poster: video.poster,
      previewUrl: video.poster ? URL.createObjectURL(video.poster) : null,
    };
  }

  let takenAt: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const exif = await exifr.parse(file, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false });
    const date: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (date instanceof Date && !Number.isNaN(date.getTime())) takenAt = date.toISOString();
    // Phones without a GPS fix can write empty 0/0 values, which read as NaN or as the 0,0 point off Africa.
    const latitude = finite(exif?.latitude);
    const longitude = finite(exif?.longitude);
    if (latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0)) {
      lat = latitude;
      lng = longitude;
    }
  } catch {
    // Photos without EXIF are fine.
  }

  let display: Blob | null = null;
  let decoded = await loadImage(typedFile).catch(() => null);
  // Only older/non-Apple browsers need the software HEIC decoder.
  if (heic && !decoded && options.portableDisplay !== false) {
    onStage?.("converting");
    try {
      const { heicTo } = await import("heic-to");
      const converted = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
      decoded = await loadImage(converted);
    } catch {
      throw new Error("heic_conversion_failed");
    }
  }

  let width: number | null = null;
  let height: number | null = null;
  let thumbhash: string | null = null;
  let previewUrl: string | null = null;
  if (decoded) {
    try {
      width = decoded.image.naturalWidth;
      height = decoded.image.naturalHeight;
      thumbhash = thumbhashOf(decoded.image, width, height);
      if (heic && options.portableDisplay !== false) {
        onStage?.("converting");
        display = await jpegOf(decoded.image, width, height, 2400);
        // Most server builds cannot decode HEIC, so require a portable display copy.
        if (!display) throw new Error("heic_conversion_failed");
      }
      const preview = await jpegOf(decoded.image, width, height, 480, 0.78);
      if (preview) previewUrl = URL.createObjectURL(preview);
    } finally {
      decoded.dispose();
    }
  }

  return {
    ...base,
    type: "photo",
    width,
    height,
    durationSec: null,
    takenAt: takenAt ?? modifiedAt(file),
    lat,
    lng,
    thumbhash,
    display,
    poster: null,
    previewUrl,
  };
}

export function putWithProgress(target: { url: string; headers: Record<string, string> }, body: Blob, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.url);
    for (const [key, value] of Object.entries(target.headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload_missing")));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("network"));
    xhr.send(body);
  });
}

/** POSTs a file to a signed Cloudinary upload form and resolves with Cloudinary's JSON answer. */
export function postWithProgress(target: { url: string; fields: Record<string, string> }, file: Blob, onProgress: (fraction: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(target.fields)) form.append(key, value);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        // Not JSON; treated as a failed upload below.
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      const message = String((body.error as { message?: unknown } | undefined)?.message ?? "");
      reject(new Error(/file size too large/i.test(message) ? "cloudinary_too_large" : "cloudinary_upload_failed"));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("network"));
    xhr.send(form);
  });
}
