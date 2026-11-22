/** File pickers can omit MIME types, especially when a file comes from iCloud or Files. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  hif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  mov: "video/quicktime",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "video/x-m4v": "video/mp4",
};

/** A reported media MIME wins: iOS may export a HEIC as JPEG while keeping its name. */
export function mediaFileInfo(name: string, reportedMime: string) {
  const reported = reportedMime.split(";", 1)[0]!.trim().toLowerCase();
  const normalized = MIME_ALIASES[reported] ?? reported;
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const mime = /^(image|video)\//.test(normalized)
    ? normalized
    : !normalized || normalized === "application/octet-stream" || normalized === "binary/octet-stream"
      ? (MIME_BY_EXTENSION[extension ?? ""] ?? normalized)
      : normalized;
  const type = mime.startsWith("image/") ? "photo" : mime.startsWith("video/") ? "video" : null;
  return { mime, type, heic: /^image\/hei[cf](?:-sequence)?$/.test(mime) } as const;
}
