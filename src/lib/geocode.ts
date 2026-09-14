import { eq } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { env } from "@/lib/env";
import type { AddressParts } from "@/lib/regions";

type PlaceInfo = {
  name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  district: string | null;
  village: string | null;
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
  return {
    name,
    city,
    region: a.state ?? null,
    country: a.country ?? null,
    district: valuesOf(a, DISTRICT_KEYS)[0] ?? null,
    village: valuesOf(a, VILLAGE_KEYS)[0] ?? null,
  };
}

export type ReverseAddress = { countryCode: string | null; country: string | null; address: AddressParts };

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
    ? { name: null, city: null, region: null, country: null, district: null, village: null, ...known }
    : await reverseGeocode(lat, lng).catch(() => null);
  return insertPlace({
    key,
    name: info?.name ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    city: info?.city ?? null,
    region: info?.region ?? null,
    country: info?.country ?? null,
    district: info?.district ?? null,
    village: info?.village ?? null,
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
  country: string | null;
  regionCode: string | null;
  lat: number | null;
  lng: number | null;
};

/** A place picked by hand. Without coordinates it sits at the centre of its area; returns null when that can't be found. */
export async function findOrCreateNamedPlace(place: NamedPlace) {
  const [existing] = await db.select({ id: places.id }).from(places).where(eq(places.key, place.key)).limit(1);
  if (existing) return existing.id;

  const position =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng }
      : await geocodeNames([place.village, place.district, place.city, place.region].filter((name): name is string => Boolean(name))).catch(
          () => null,
        );
  if (!position) return null;
  return insertPlace({ ...place, lat: position.lat, lng: position.lng });
}
