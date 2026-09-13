import { eq } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { env } from "@/lib/env";

type PlaceInfo = { name: string | null; city: string | null; region: string | null; country: string | null };

let lastLookup = 0;

/** OpenStreetMap Nominatim allows one request per second and asks apps to identify themselves. */
async function reverseGeocode(lat: number, lng: number): Promise<PlaceInfo | null> {
  if (process.env.GEOCODING === "off") return null;
  const wait = lastLookup + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastLookup = Date.now();

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=id,en`;
  const response = await fetch(url, {
    headers: { "User-Agent": `GalleryOfOurs/1.0 (${env.appUrl})` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { name?: string; address?: Record<string, string> };
  const a = data.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
  const name = data.name || a.suburb || a.neighbourhood || city || a.state || null;
  return { name, city, region: a.state ?? null, country: a.country ?? null };
}

/** Photos within roughly a kilometre share one place. */
export async function findOrCreatePlace(lat: number, lng: number, known?: Partial<PlaceInfo>) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const [existing] = await db.select({ id: places.id }).from(places).where(eq(places.key, key)).limit(1);
  if (existing) return existing.id;

  const info = known?.name ? { name: null, city: null, region: null, country: null, ...known } : await reverseGeocode(lat, lng).catch(() => null);
  const [inserted] = await db
    .insert(places)
    .values({
      key,
      name: info?.name ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      city: info?.city ?? null,
      region: info?.region ?? null,
      country: info?.country ?? null,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
    })
    .onConflictDoNothing({ target: places.key })
    .returning({ id: places.id });
  if (inserted) return inserted.id;

  const [raced] = await db.select({ id: places.id }).from(places).where(eq(places.key, key)).limit(1);
  return raced?.id ?? null;
}
