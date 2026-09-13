import { downloadZip } from "client-zip";
import { and, asc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { isAlbumLocked } from "@/lib/permissions";
import { shareAllowsAlbum, shareCookieName } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "album";

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const [album] = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, id), isNull(albums.deletedAt)))
    .limit(1);
  if (!album) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  let allowed = user?.status === "active" && !isAlbumLocked(album, user.id);
  if (!allowed) {
    const token = request.nextUrl.searchParams.get("share");
    if (token && !isAlbumLocked(album, null)) {
      const cookieValue = (await cookies()).get(shareCookieName(token))?.value;
      allowed = await shareAllowsAlbum(token, album.id, cookieValue);
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const items = await db
    .select()
    .from(media)
    .where(and(eq(media.albumId, album.id), isNull(media.deletedAt)))
    .orderBy(asc(media.takenAt));
  const files = await storage();
  const used = new Map<string, number>();

  async function* entries() {
    for (const item of items) {
      const base = safeName(item.originalName ?? `${item.id}.${item.originalKey.split(".").pop()}`);
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const name = seen ? base.replace(/(\.[^.]*)?$/, ` (${seen})$1`) : base;
      yield { name, lastModified: item.takenAt ?? item.createdAt, input: await files.getBuffer(item.originalKey) };
    }
  }

  const zip = downloadZip(entries());
  return new Response(zip.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName(album.title))}.zip`,
      "Cache-Control": "no-store",
    },
  });
}
