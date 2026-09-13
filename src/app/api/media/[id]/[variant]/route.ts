import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { isAdmin, isAlbumLocked } from "@/lib/permissions";
import { shareAllowsAlbum, shareCookieName } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

type Context = { params: Promise<{ id: string; variant: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANTS = new Set(["thumb", "medium", "large", "original", "poster", "download"]);

export async function GET(request: NextRequest, context: Context) {
  const { id, variant } = await context.params;
  if (!UUID.test(id) || !VARIANTS.has(variant)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({
      item: media,
      unlockAt: albums.unlockAt,
      createdById: albums.createdById,
      albumDeletedAt: albums.deletedAt,
    })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .where(eq(media.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const { item } = row;
  const deleted = Boolean(item.deletedAt || row.albumDeletedAt);
  const user = await getCurrentUser();
  let allowed = false;

  if (user?.status === "active") {
    allowed = (!deleted || isAdmin(user)) && !isAlbumLocked(row, user.id);
  } else {
    const token = request.nextUrl.searchParams.get("share");
    if (token && !deleted && !isAlbumLocked(row, null)) {
      const cookieValue = (await cookies()).get(shareCookieName(token))?.value;
      allowed = await shareAllowsAlbum(token, item.albumId, cookieValue);
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const fallback = item.type === "video" ? item.posterKey : (item.displayKey ?? item.originalKey);
  let key: string | null | undefined;
  switch (variant) {
    case "thumb":
    case "medium":
    case "large":
      key = item.variants[variant]?.key ?? fallback;
      break;
    case "poster":
      key = item.posterKey ?? item.variants.large?.key;
      break;
    default:
      key = item.originalKey;
  }
  if (!key) return new Response("Not found", { status: 404 });

  const files = await storage();
  const target = await files.presignGet(key, {
    expiresInSec: 7200,
    filename: variant === "download" ? (item.originalName ?? key.split("/").pop()) : undefined,
  });
  const response = NextResponse.redirect(new URL(target, request.url), 302);
  response.headers.set("Cache-Control", variant === "download" ? "no-store" : "private, max-age=1500");
  return response;
}
