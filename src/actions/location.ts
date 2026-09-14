"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { albums, media, places } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { findOrCreateNamedPlace } from "@/lib/geocode";
import { assertCanEditAlbum } from "@/lib/permissions";
import { REGION_CODE } from "@/lib/regions";
import { actionUser } from "@/lib/session";

const Target = z.object({ kind: z.enum(["album", "media"]), id: z.uuid() });
const Name = z.string().trim().min(1).max(120);
const LocationInput = z.object({
  /** The deepest region picked, e.g. "51.04.04"; null outside Indonesia. */
  regionCode: z.string().regex(REGION_CODE).nullable(),
  province: Name.nullable(),
  regency: Name.nullable(),
  district: Name.nullable(),
  village: Name.nullable(),
  /** Dusun, lingkungan or kampung typed by hand. No official list goes below the village, so it's kept only with one. */
  hamlet: Name.nullable().optional(),
  /** A spot chosen from search; without one the place sits at the centre of the region. */
  point: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().trim().min(1).max(200),
      country: z.string().trim().max(120).nullable(),
    })
    .nullable(),
});

export type LocationTarget = z.input<typeof Target>;
export type LocationValue = z.input<typeof LocationInput>;
export type PlaceSummary = { name: string; detail: string; regionCode: string | null; hamlet: string | null };
/** Photos in an album, and how many of them have no location of their own and so use the album's. */
export type AlbumUsage = { total: number; inherited: number };

async function loadTarget(input: LocationTarget) {
  const parsed = Target.safeParse(input);
  if (!parsed.success) throw new UserError("invalid_input");
  const { kind, id } = parsed.data;
  const current = await actionUser();

  let albumId = id;
  let mediaPlaceId: string | null = null;
  if (kind === "media") {
    const [item] = await db.select({ albumId: media.albumId, placeId: media.placeId }).from(media).where(eq(media.id, id)).limit(1);
    if (!item) throw new UserError("not_found");
    albumId = item.albumId;
    mediaPlaceId = item.placeId;
  }
  const [album] = await db.select({ placeId: albums.placeId, deletedAt: albums.deletedAt }).from(albums).where(eq(albums.id, albumId)).limit(1);
  if (!album || album.deletedAt) throw new UserError("album_missing");
  await assertCanEditAlbum(current, albumId);
  return { current, kind, id, albumId, ownPlaceId: kind === "album" ? album.placeId : mediaPlaceId, albumPlaceId: album.placeId };
}

async function summarize(placeId: string | null): Promise<PlaceSummary | null> {
  if (!placeId) return null;
  const [place] = await db.select().from(places).where(eq(places.id, placeId)).limit(1);
  if (!place) return null;
  const detail = [place.hamlet, place.village, place.district, place.city, place.region, place.country].filter(
    (part): part is string => Boolean(part) && part !== place.name,
  );
  return { name: place.name, detail: [...new Set(detail)].join(", "), regionCode: place.regionCode, hamlet: place.hamlet };
}

const albumPhotos = (albumId: string) =>
  and(eq(media.albumId, albumId), isNull(media.deletedAt), inArray(media.status, ["uploading", "processing", "ready"]));

async function albumUsage(albumId: string): Promise<AlbumUsage> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int`, inherited: sql<number>`(count(*) filter (where ${media.placeId} is null))::int` })
    .from(media)
    .where(albumPhotos(albumId));
  return { total: row?.total ?? 0, inherited: row?.inherited ?? 0 };
}

/** The target's own location, the album location a photo falls back to, and for an album how many photos use it. */
export async function getLocation(target: LocationTarget) {
  return run(async () => {
    const loaded = await loadTarget(target);
    return {
      own: await summarize(loaded.ownPlaceId),
      album: loaded.kind === "media" ? await summarize(loaded.albumPlaceId) : null,
      usage: loaded.kind === "album" ? await albumUsage(loaded.albumId) : null,
    };
  });
}

/**
 * Sets or (with null) removes the location of an album or of one photo or video. For an album, `replaceOwn` also
 * clears the photos' own locations so every photo uses (and keeps following) the album's.
 */
export async function setLocation(target: LocationTarget, value: LocationValue | null, options?: { replaceOwn?: boolean }) {
  return run(async () => {
    const loaded = await loadTarget(target);
    let placeId: string | null = null;
    let point: { lat: number; lng: number } | null = null;

    if (value) {
      const parsed = LocationInput.safeParse(value);
      if (!parsed.success) throw new UserError("invalid_input");
      const location = parsed.data;
      const depth = location.regionCode?.split(".").length ?? 0;
      const names = {
        region: location.province,
        city: depth >= 2 ? location.regency : null,
        district: depth >= 3 ? location.district : null,
        village: depth >= 4 ? location.village : null,
        hamlet: depth >= 4 ? (location.hamlet ?? null) : null,
      };

      if (location.point) {
        point = { lat: location.point.lat, lng: location.point.lng };
        placeId = await findOrCreateNamedPlace({
          key: `point:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
          name: location.point.name,
          ...names,
          country: location.point.country,
          regionCode: location.regionCode,
          ...point,
        });
      } else {
        if (depth < 2 || !names.region || !names.city || (depth >= 3 && !names.district) || (depth >= 4 && !names.village)) {
          throw new UserError("invalid_input");
        }
        // Each dusun of a village is a place of its own, so it can sit at its own spot on the map.
        const hamletKey = names.hamlet ? `:${names.hamlet.toLowerCase().split(/\s+/).join(" ")}` : "";
        placeId = await findOrCreateNamedPlace({
          key: `region:${location.regionCode}${hamletKey}`,
          name: names.hamlet ?? names.village ?? names.district ?? names.city,
          ...names,
          country: "Indonesia",
          regionCode: location.regionCode,
          lat: null,
          lng: null,
        });
      }
      if (!placeId) throw new UserError("location_not_found");
    }

    const replaceOwn = loaded.kind === "album" && placeId !== null && options?.replaceOwn === true;
    if (loaded.kind === "album") {
      await db.update(albums).set({ placeId }).where(eq(albums.id, loaded.id));
      if (replaceOwn) {
        // Their GPS or hand-picked places are dropped, so they sit at the album's place and follow it from now on.
        await db.update(media).set({ placeId: null, lat: null, lng: null }).where(albumPhotos(loaded.id));
      }
    } else {
      // A hand-picked place replaces the GPS reading, so the photo moves there on the map.
      await db
        .update(media)
        .set({ placeId, lat: point?.lat ?? null, lng: point?.lng ?? null })
        .where(eq(media.id, loaded.id));
    }
    await logActivity(loaded.current.id, "location.set", loaded.kind, loaded.id, { placeId, replaceOwn });
    for (const path of [`/albums/${loaded.albumId}`, "/places", "/globe", "/home", "/timeline"]) revalidatePath(path);
    return null;
  });
}
