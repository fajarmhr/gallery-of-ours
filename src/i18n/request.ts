import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";

export const isLocale = (value: unknown): value is Locale => value === "en" || value === "id";

export async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  return /(^|,)\s*id\b/i.test(acceptLanguage) ? "id" : "en";
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: process.env.APP_TIMEZONE || "Asia/Jakarta",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
