import { eq } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { env } from "@/lib/env";
import { normalizeRegionName, type AddressParts } from "@/lib/regions";

type PlaceInfo = {
  name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  district: string | null;
  village: string | null;
  hamlet: string | null;
};
type OsmAddress = Record<string, string | undefined>;

const userAgent = () => `GalleryOfOurs/1.0 (${env.appUrl})`;
const geocodingOff = () => process.env.GEOCODING === "off";

// Address keys OpenStreetMap uses for Indonesian regencies, districts (kecamatan) and villages (desa/kelurahan), likeliest first.
const REGENCY_KEYS = ["city", "county", "regency", "municipality"];
const DISTRICT_KEYS = ["city_district", "district", "subdistrict", "municipality", "suburb", "town"];
const VILLAGE_KEYS = ["village", "suburb", "quarter", "neighbourhood", "hamlet", "town"];

const valuesOf = (address: OsmAddress, keys: string[]) =>
  [...new Set(keys.map((key) => address[key]).filter((value): value is string => Boolean(value)))];

/** OpenStreetMap files a dusun as a hamlet; one that only stands in for a missing village isn't a dusun. */
const hamletOf = (address: OsmAddress, village: string | null) => (address.hamlet && address.hamlet !== village ? address.hamlet : null);

let nextSlot = 0;

/** OpenStreetMap Nominatim allows one request per second and asks apps to identify themselves. */
async function nominatim<T>(path: string): Promise<T | null> {
  if (geocodingOff()) return null;
  const slot = Math.max(Date.now(), nextSlot);
  nextSlot = slot + 1100;
  if (slot > Date.now()) await new Promise((resolve) => setTimeout(resolve, slot - Date.now()));
  const response = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { "User-Agent": userAgent() },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

const reverseLookup = (lat: number, lng: number, zoom: number) =>
  nominatim<{ name?: string; address?: OsmAddress }>(
    `reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1&accept-language=id,en`,
  );

async function reverseGeocode(lat: number, lng: number): Promise<PlaceInfo | null> {
  const data = await reverseLookup(lat, lng, 14);
  if (!data) return null;
  const a = data.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
  const name = data.name || a.suburb || a.neighbourhood || city || a.state || null;
  const village = valuesOf(a, VILLAGE_KEYS)[0] ?? null;
  return {
    name,
    city,
    region: a.state ?? null,
    country: a.country ?? null,
    district: valuesOf(a, DISTRICT_KEYS)[0] ?? null,
    village,
    hamlet: hamletOf(a, village),
  };
}

export type ReverseAddress = {
  countryCode: string | null;
  country: string | null;
  address: AddressParts;
  /** A dusun OpenStreetMap has at the spot; it can still repeat the village name. */
  hamlet: string | null;
};

/** The administrative areas around a point, for matching against the Indonesian region list. */
export async function reverseAddress(lat: number, lng: number): Promise<ReverseAddress | null> {
  const address = (await reverseLookup(lat, lng, 18))?.address;
  if (!address) return null;
  return {
    countryCode: address.country_code?.toUpperCase() ?? null,
    country: address.country ?? null,
    address: {
      iso: address["ISO3166-2-lvl4"] ?? null,
      state: address.state ?? address.province ?? null,
      regency: valuesOf(address, REGENCY_KEYS),
      district: valuesOf(address, DISTRICT_KEYS),
      village: valuesOf(address, VILLAGE_KEYS),
    },
    hamlet: hamletOf(address, address.village ?? null),
  };
}

export type PlaceSearchResult = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  country: string | null;
};

type PhotonFeature = { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> };

/** Photon, komoot's OpenStreetMap search, which (unlike Nominatim) allows search-as-you-type. Biased towards Indonesia. */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (geocodingOff()) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lat=-2.5&lon=118&zoom=5&location_bias_scale=0.3`;
  const response = await fetch(url, { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return [];
  const data = (await response.json()) as { features?: PhotonFeature[] };

  const results = new Map<string, PlaceSearchResult>();
  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const text = (key: string) => (typeof props[key] === "string" && props[key] ? (props[key] as string) : null);
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    const name = text("name") ?? text("street") ?? text("city");
    if (!name || typeof lat !== "number" || typeof lng !== "number") continue;
    const id = `${text("osm_type") ?? "x"}${String(props.osm_id ?? `${lat},${lng}`)}`;
    const detail = [...new Set([text("district"), text("city") ?? text("county"), text("state"), text("country")])]
      .filter((part): part is string => Boolean(part) && part !== name)
      .join(", ");
    results.set(id, { id, name, detail, lat, lng, countryCode: text("countrycode")?.toUpperCase() ?? null, country: text("country") });
  }
  return [...results.values()];
}

export type HamletArea = { code: string; village: string; district: string; regency: string; province: string };

const hamletCache = new Map<string, string[]>();

/**
 * Named dusun, lingkungan and kampung OpenStreetMap has in and around a village, from Overpass. Often empty: no official
 * list goes below the village, and mapping in rural areas is patchy.
 */
export async function suggestHamlets(area: HamletArea): Promise<string[]> {
  if (geocodingOff()) return [];
  const cached = hamletCache.get(area.code);
  if (cached) return cached;

  const query = [area.village, area.district, area.regency, area.province, "Indonesia"].join(", ");
  const [found] =
    (await nominatim<{ lat: string; lon: string; boundingbox?: string[] }[]>(
      `search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`,
    )) ?? [];
  if (!found) return [];

  // A village mapped as a boundary has a real box; one mapped as a single point gets about 2 km around it.
  // The cap keeps a wrong match from pulling in a whole regency.
  const [south, north, west, east] = (found.boundingbox ?? []).map(Number);
  const boxed = [south, north, west, east].every((value) => Number.isFinite(value));
  const centreLat = boxed ? (south! + north!) / 2 : Number(found.lat);
  const centreLng = boxed ? (west! + east!) / 2 : Number(found.lon);
  if (!Number.isFinite(centreLat) || !Number.isFinite(centreLng)) return [];
  const halfLat = Math.min(0.08, Math.max(0.02, boxed ? (north! - south!) / 2 : 0));
  const halfLng = Math.min(0.08, Math.max(0.02, boxed ? (east! - west!) / 2 : 0));
  const bbox = [centreLat - halfLat, centreLng - halfLng, centreLat + halfLat, centreLng + halfLng].map((value) => value.toFixed(5)).join(",");

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": userAgent(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: `[out:json][timeout:15];nwr["place"~"^(hamlet|isolated_dwelling|neighbourhood|quarter)$"]["name"](${bbox});out tags 150;` }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { elements?: { tags?: Record<string, string> }[] };

  const village = normalizeRegionName(area.village);
  const names = [...new Set((data.elements ?? []).map((element) => element.tags?.name?.trim()).filter((name): name is string => Boolean(name)))]
    .filter((name) => normalizeRegionName(name) !== village)
    .sort((a, b) => a.localeCompare(b, "id"));
  if (hamletCache.size >= 500) hamletCache.delete(hamletCache.keys().next().value!);
  hamletCache.set(area.code, names);
  return names;
}

/** The centre of a named area, dropping the most specific name until OpenStreetMap knows it. */
async function geocodeNames(names: string[]) {
  for (let start = 0; start < names.length; start++) {
    const query = [...names.slice(start), "Indonesia"].join(", ");
    const found = await nominatim<{ lat: string; lon: string }[]>(
      `search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`,
    );
    const lat = Number(found?.[0]?.lat);
    const lng = Number(found?.[0]?.lon);
    if (found?.[0] && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

async function insertPlace(values: typeof places.$inferInsert) {
  const [inserted] = await db.insert(places).values(values).onConflictDoNothing({ target: places.key }).returning({ id: places.id });
  if (inserted) return inserted.id;
  const [raced] = await db.select({ id: places.id }).from(places).where(eq(places.key, values.key)).limit(1);
  return raced?.id ?? null;
}

/** GPS photos within roughly a kilometre share one place in the list; the map still shows each exact point. */
export async function findOrCreatePlace(lat: number, lng: number, known?: Partial<PlaceInfo>) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const [existing] = await db.select({ id: places.id }).from(places).where(eq(places.key, key)).limit(1);
  if (existing) return existing.id;

  const info = known?.name
    ? { name: null, city: null, region: null, country: null, district: null, village: null, hamlet: null, ...known }
    : await reverseGeocode(lat, lng).catch(() => null);
  return insertPlace({
    key,
    name: info?.name ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    city: info?.city ?? null,
    region: info?.region ?? null,
    country: info?.country ?? null,
    district: info?.district ?? null,
    village: info?.village ?? null,
    hamlet: info?.hamlet ?? null,
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  });
}

export type NamedPlace = {
  key: string;
  name: string;
  city: string | null;
  region: string | null;
  district: string | null;
  village: string | null;
  hamlet: string | null;
  country: string | null;
  regionCode: string | null;
  lat: number | null;
  lng: number | null;
};

/** A place picked by hand. Without coordinates it sits at the centre of its area; returns null when that can't be found. */
export async function findOrCreateNamedPlace(place: NamedPlace) {
  const [existing] = await db.select({ id: places.id }).from(places).where(eq(places.key, place.key)).limit(1);
  if (existing) {
    // The same searched spot picked again stays one place, with the area from the latest pick (a corrected village, a dusun added later).
    await db
      .update(places)
      .set({
        city: place.city,
        region: place.region,
        district: place.district,
        village: place.village,
        hamlet: place.hamlet,
        country: place.country,
        regionCode: place.regionCode,
      })
      .where(eq(places.id, existing.id));
    return existing.id;
  }

  const position =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng }
      : await geocodeNames([place.hamlet, place.village, place.district, place.city, place.region].filter((name): name is string => Boolean(name))).catch(
          () => null,
        );
  if (!position) return null;
  return insertPlace({ ...place, lat: position.lat, lng: position.lng });
}
