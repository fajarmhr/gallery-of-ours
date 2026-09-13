import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { hasR2 } from "@/lib/env";
import { verifySignedParams } from "@/lib/signing";
import { localPath } from "@/lib/storage/local";

type Context = { params: Promise<{ key: string[] }> };

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

async function authorize(request: Request, context: Context, method: "GET" | "PUT") {
  if (hasR2()) return null;
  const { key: parts } = await context.params;
  const key = parts.join("/");
  const url = new URL(request.url);
  if (!verifySignedParams(key, method, url.searchParams.get("exp"), url.searchParams.get("sig"))) return null;
  try {
    return { file: localPath(key), url };
  } catch {
    return null;
  }
}

function parseRange(header: string | null, size: number) {
  const match = (header ?? "").match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return { start, end };
}

export async function PUT(request: Request, context: Context) {
  const target = await authorize(request, context, "PUT");
  if (!target) return new Response("Forbidden", { status: 403 });
  if (!request.body) return new Response("Empty body", { status: 400 });
  await mkdir(path.dirname(target.file), { recursive: true });
  await pipeline(Readable.fromWeb(request.body as NodeReadableStream), createWriteStream(target.file));
  return new Response(null, { status: 200 });
}

export async function GET(request: Request, context: Context) {
  const target = await authorize(request, context, "GET");
  if (!target) return new Response("Forbidden", { status: 403 });

  let size: number;
  try {
    size = (await stat(target.file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(target.file).slice(1).toLowerCase();
  const headers = new Headers({
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  const download = target.url.searchParams.get("download");
  if (download) headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(download)}`);

  const range = parseRange(request.headers.get("range"), size);
  if (range) {
    if (range.start > range.end || range.start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    const stream = Readable.toWeb(createReadStream(target.file, range)) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(target.file)) as ReadableStream, { status: 200, headers });
}
