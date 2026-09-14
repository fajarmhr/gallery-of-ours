/**
 * Indonesian administrative regions (Kepmendagri 2025) from the JSON files in public/regions, built by
 * scripts/build-regions.mjs. Codes nest by prefix: province "51", regency "51.04", district "51.04.04", village "51.04.04.2001".
 */

export type RegionOption = { code: string; name: string };
export type RegionPick = { province: RegionOption | null; regency: RegionOption | null; district: RegionOption | null; village: RegionOption | null };
/** Address parts from a reverse lookup, likeliest candidates first. */
export type AddressParts = { iso: string | null; state: string | null; regency: string[]; district: string[]; village: string[] };

export const REGION_CODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;
export const emptyPick = (): RegionPick => ({ province: null, regency: null, district: null, village: null });

type Pair = [string, string];
type ProvinceFile = { r: Pair[]; d: Record<string, Pair[]> };

const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let request = cache.get(path);
  if (!request) {
    request = fetch(path).then((response) => {
      if (!response.ok) throw new Error(`Loading ${path} returned ${response.status}`);
      return response.json();
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request as Promise<T>;
}

const toOptions = (pairs: Pair[] | undefined): RegionOption[] => (pairs ?? []).map(([code, name]) => ({ code, name }));

export const loadProvinces = async () => toOptions(await load<Pair[]>("/regions/provinces.json"));
export const loadRegencies = async (provinceCode: string) => toOptions((await load<ProvinceFile>(`/regions/p/${provinceCode}.json`)).r);
export const loadDistricts = async (regencyCode: string) =>
  toOptions((await load<ProvinceFile>(`/regions/p/${regencyCode.slice(0, 2)}.json`)).d[regencyCode]);
export const loadVillages = async (districtCode: string) =>
  toOptions((await load<Record<string, Pair[]>>(`/regions/v/${districtCode.slice(0, 5)}.json`))[districtCode]);

/** Rebuilds every level of a saved code, e.g. "51.04.04" → Bali / Kabupaten Gianyar / Ubud. */
export async function pickFromCode(code: string): Promise<RegionPick> {
  const pick = emptyPick();
  if (!REGION_CODE.test(code)) return pick;
  const parts = code.split(".");
  const prefix = (depth: number) => parts.slice(0, depth).join(".");
  pick.province = (await loadProvinces()).find((o) => o.code === prefix(1)) ?? null;
  if (pick.province && parts.length >= 2) pick.regency = (await loadRegencies(prefix(1))).find((o) => o.code === prefix(2)) ?? null;
  if (pick.regency && parts.length >= 3) pick.district = (await loadDistricts(prefix(2))).find((o) => o.code === prefix(3)) ?? null;
  if (pick.district && parts.length >= 4) pick.village = (await loadVillages(prefix(3))).find((o) => o.code === prefix(4)) ?? null;
  return pick;
}

/* ───────────── Matching a looked-up address to the list ───────────── */

/** ISO 3166-2:ID subdivision → Kepmendagri province code. */
const PROVINCE_BY_ISO: Record<string, string> = {
  AC: "11", SU: "12", SB: "13", RI: "14", JA: "15", SS: "16", BE: "17", LA: "18", BB: "19", KR: "21",
  JK: "31", JB: "32", JT: "33", YO: "34", JI: "35", BT: "36", BA: "51", NB: "52", NT: "53",
  KB: "61", KT: "62", KS: "63", KI: "64", KU: "65", SA: "71", ST: "72", SN: "73", SG: "74", GO: "75", SR: "76",
  MA: "81", MU: "82", PA: "91", PB: "92", PS: "93", PT: "94", PE: "95", PD: "96",
};

const COMBINING_MARKS = /\p{M}/gu;
const LEADING_TYPE =
  /^(provinsi|daerah khusus ibukota|daerah istimewa|kabupaten administrasi|kabupaten|kab|kota administrasi|kota adm|kota|kecamatan|kec|distrik|kelurahan|kel|desa|nagari|gampong|kampung) /;

/** Lowercase, no accents or punctuation, and no leading "Kabupaten", "Kota", "Desa" and the like. */
export function normalizeRegionName(name: string) {
  let value = name.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (let previous = ""; previous !== value; ) {
    previous = value;
    value = value.replace(LEADING_TYPE, "");
  }
  return value;
}

const kindOf = (name: string) => (/^\s*kota\b/i.test(name) ? "kota" : /^\s*kab(upaten)?\b/i.test(name) ? "kabupaten" : null);
const containsWords = (longer: string, shorter: string) => ` ${longer} `.includes(` ${shorter} `);

/** The option whose name best matches one of the candidates (earlier candidates win ties), or null when nothing is close. */
export function bestRegionMatch(options: RegionOption[], candidates: (string | null | undefined)[]) {
  let best: RegionOption | null = null;
  let bestScore = 0;
  for (const [index, raw] of candidates.entries()) {
    if (!raw) continue;
    const target = normalizeRegionName(raw);
    if (target.length < 2) continue;
    for (const option of options) {
      const name = normalizeRegionName(option.name);
      const close = name.length > 3 && target.length > 3 && (containsWords(target, name) || containsWords(name, target));
      let score = name === target ? 20 : close ? 10 : 0;
      if (!score) continue;
      const kind = kindOf(raw);
      if (kind && kind === kindOf(option.name)) score += 3;
      score -= index * 0.1;
      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }
  }
  return best;
}

const parentOf = (options: RegionOption[], code: string) => options.find((option) => code.startsWith(`${option.code}.`)) ?? null;

/**
 * Fills as many levels as the address allows. OpenStreetMap files Indonesian areas unevenly (Jakarta's "city" is the
 * province, Ubud has no regency at all), so names are tried one level down too, and a level that can't be matched is
 * found through the level below it.
 */
export async function pickFromAddress(address: AddressParts): Promise<RegionPick> {
  const pick = emptyPick();
  const provinces = await loadProvinces();
  const isoCode = address.iso ? PROVINCE_BY_ISO[address.iso.replace(/^ID-/, "")] : undefined;
  pick.province = provinces.find((o) => o.code === isoCode) ?? bestRegionMatch(provinces, [address.state]);
  if (!pick.province) return pick;

  const provinceName = normalizeRegionName(pick.province.name);
  const names = (...lists: string[][]) => [...new Set(lists.flat())].filter((name) => normalizeRegionName(name) !== provinceName);
  const regencyNames = names(address.regency, address.district);
  const districtNames = names(address.district, address.village);
  const villageNames = names(address.village);

  const province = await load<ProvinceFile>(`/regions/p/${pick.province.code}.json`);
  const regencies = toOptions(province.r);
  pick.regency = bestRegionMatch(regencies, regencyNames);
  if (!pick.regency) {
    const district = bestRegionMatch(Object.values(province.d).flatMap(toOptions), districtNames);
    if (district) {
      pick.regency = parentOf(regencies, district.code);
      pick.district = district;
    }
  }
  if (!pick.regency) return pick;

  const districts = toOptions(province.d[pick.regency.code]);
  pick.district ??= bestRegionMatch(districts, districtNames);
  if (!pick.district) {
    const villages = await load<Record<string, Pair[]>>(`/regions/v/${pick.regency.code}.json`);
    const village = bestRegionMatch(Object.values(villages).flatMap(toOptions), villageNames);
    if (village) {
      pick.district = parentOf(districts, village.code);
      pick.village = village;
    }
  }
  if (!pick.district) return pick;

  pick.village ??= bestRegionMatch(await loadVillages(pick.district.code), villageNames);
  return pick;
}
