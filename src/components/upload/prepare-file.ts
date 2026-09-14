import exifr from "exifr";
import { rgbaToThumbHash } from "thumbhash";

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

export const isHeicFile = (file: File) => /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
export const isSupportedFile = (file: File) =>
  file.type.startsWith("image/") || file.type.startsWith("video/") || isHeicFile(file);

const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The file's modified time, when the browser reports a real one. */
const modifiedAt = (file: File) => (file.lastModified > 0 ? new Date(file.lastModified).toISOString() : null);

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

async function imageSize(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function thumbhashOf(source: Blob | CanvasImageSource, width: number, height: number) {
  try {
    const scale = 100 / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (source instanceof Blob) {
      const bitmap = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
      context.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
    } else {
      context.drawImage(source, 0, 0, w, h);
    }
    return toBase64(rgbaToThumbHash(w, h, context.getImageData(0, 0, w, h).data));
  } catch {
    return null;
  }
}

function readVideo(file: File): Promise<{ width: number | null; height: number | null; duration: number | null; poster: Blob | null }> {
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
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 15_000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (Number.isFinite(video.duration) ? video.duration : 1) / 3);
    };
    video.onseeked = () => {
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.85);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/** Reads date, GPS and size, converts HEIC for browsers and builds a tiny blurred preview. */
export async function prepareFile(file: File, onStage?: (stage: "reading" | "converting") => void): Promise<PreparedFile> {
  onStage?.("reading");
  const heic = isHeicFile(file);
  const base = {
    name: file.name,
    mime: file.type || (heic ? "image/heic" : "application/octet-stream"),
    size: file.size,
  };

  if (file.type.startsWith("video/")) {
    const video = await readVideo(file);
    const thumbhash = video.poster && video.width && video.height ? await thumbhashOf(video.poster, video.width, video.height) : null;
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
  if (heic) {
    onStage?.("converting");
    try {
      const { heicTo } = await import("heic-to");
      display = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    } catch {
      display = null;
    }
  }

  const source = display ?? file;
  let width: number | null = null;
  let height: number | null = null;
  let thumbhash: string | null = null;
  try {
    const size = await imageSize(source);
    width = size.width || null;
    height = size.height || null;
    if (width && height) thumbhash = await thumbhashOf(source, width, height);
  } catch {
    // Unreadable in this browser; the server still processes the original.
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
    previewUrl: width ? URL.createObjectURL(source) : null,
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
    xhr.send(form);
  });
}
