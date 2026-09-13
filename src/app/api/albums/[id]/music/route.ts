import { and, eq, isNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { albums } from "@/db/schema";
import { isAlbumLocked } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return new Response("Not found", { status: 404 });

  const [album] = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, id), isNull(albums.deletedAt)))
    .limit(1);
  if (!album?.musicKey || isAlbumLocked(album, user.id)) return new Response("Not found", { status: 404 });

  const target = await (await storage()).presignGet(album.musicKey, { expiresInSec: 7200 });
  const response = NextResponse.redirect(new URL(target, request.url), 302);
  response.headers.set("Cache-Control", "private, max-age=1500");
  return response;
}
