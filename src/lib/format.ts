export const TRASH_DAYS = 30;

/** YYYY-MM-DD of a moment in the family's time zone. */
export const dayKey = (value: string | Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

/** The orange date imprint of old film cameras, e.g. '24 8 17. */
export const filmStamp = (value: string | Date, timeZone: string) => {
  const [y, m, d] = dayKey(value, timeZone).split("-");
  return `'${y!.slice(2)} ${Number(m)} ${d}`;
};

export type MediaUrlVariant = "thumb" | "medium" | "large" | "original" | "poster" | "download";

export const mediaUrl = (id: string, variant: MediaUrlVariant, shareToken?: string | null) =>
  `/api/media/${id}/${variant}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`;

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function daysBetween(from: Date, to: Date, timeZone?: string) {
  if (timeZone) {
    const midnight = (date: Date) => Date.parse(`${dayKey(date, timeZone)}T00:00:00Z`);
    return Math.round((midnight(to) - midnight(from)) / 86_400_000);
  }
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** A date-only value anchored at noon in its own time zone, independent of the server's time zone. */
export function calendarDate(isoDate: string, timeZone: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, 12);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  });
  let instant = target;
  // Resolve the zone's offset at this date, including daylight-saving changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, Number(part.value)]));
    const observed = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
    const adjustment = target - observed;
    if (adjustment === 0) break;
    instant += adjustment;
  }
  return new Date(instant);
}

/** Next date a milestone happens, counting today. Non-repeating dates in the past return null. */
export function nextOccurrence(isoDate: string, repeatsYearly: boolean, now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!repeatsYearly) {
    const date = calendarDate(isoDate, timeZone);
    return daysBetween(now, date, timeZone) >= 0 ? date : null;
  }
  const year = Number(dayKey(now, timeZone).slice(0, 4));
  const monthDay = isoDate.slice(4);
  let candidate = calendarDate(`${year}${monthDay}`, timeZone);
  if (daysBetween(now, candidate, timeZone) < 0) candidate = calendarDate(`${year + 1}${monthDay}`, timeZone);
  return candidate;
}

export function yearsSince(isoDate: string, on: Date, timeZone?: string) {
  const year = timeZone ? Number(dayKey(on, timeZone).slice(0, 4)) : on.getFullYear();
  return year - Number(isoDate.slice(0, 4));
}

export function formatDateRange(locale: string, start?: string | null, end?: string | null) {
  if (!start) return null;
  const fmt = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const a = new Date(`${start}T00:00:00`);
  if (!end || end === start) return fmt.format(a);
  return fmt.formatRange(a, new Date(`${end}T00:00:00`));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
