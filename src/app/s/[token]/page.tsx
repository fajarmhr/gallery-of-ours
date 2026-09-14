import { eq, sql } from "drizzle-orm";
import { Download, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { after } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-shell";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { MediaGallery, type MediaGroup } from "@/components/media/media-grid";
import { LanguageSwitch } from "@/components/preferences";
import { UnlockForm } from "@/components/share/unlock-form";
import { db } from "@/db";
import { shareLinks, user } from "@/db/schema";
import { env } from "@/lib/env";
import { dayKey, formatDateRange, mediaUrl } from "@/lib/format";
import { isAlbumLocked } from "@/lib/permissions";
import { getActiveShareLink, getAlbum, getAlbumMedia, shareCookieName, shareCookieValue } from "@/lib/queries";

export const metadata: Metadata = { title: "Shared album", robots: { index: false, follow: false } };

export default async function SharedAlbumPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const t = await getTranslations("share");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const locale = await getLocale();

  const link = await getActiveShareLink(token);
  const row = link ? await getAlbum(link.albumId) : null;
  const available = Boolean(link && row && !row.album.deletedAt && !isAlbumLocked(row.album, null));

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <span className="flex items-center gap-3">
          <Brand />
          <span className="hidden text-sm text-muted-foreground sm:inline">{t("sharedWithYou")}</span>
        </span>
        <LanguageSwitch compact />
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8">{children}</main>
    </div>
  );

  if (!available || !link || !row) {
    return shell(<EmptyState icon={LinkIcon} title={t("unavailableTitle")} text={t("unavailableText")} className="mt-10" />);
  }

  if (link.passwordHash) {
    const cookieValue = (await cookies()).get(shareCookieName(token))?.value;
    if (cookieValue !== shareCookieValue(link)) {
      return shell(
        <div className="flex justify-center pt-10">
          <AuthCard>
            <UnlockForm token={token} />
          </AuthCard>
        </div>,
      );
    }
  }

  after(() => db.update(shareLinks).set({ viewCount: sql`${shareLinks.viewCount} + 1` }).where(eq(shareLinks.id, link.id)));

  const { album } = row;
  const [items, [sharer]] = await Promise.all([
    getAlbumMedia(album.id),
    link.createdById ? db.select({ name: user.name }).from(user).where(eq(user.id, link.createdById)).limit(1) : Promise.resolve([]),
  ]);
  // Only the first name: the note reads like one family member handing over the photos.
  const sharerName = sharer?.name.split(" ")[0] || null;
  const timeZone = env.timeZone;
  const groups: MediaGroup[] = [];
  for (const item of items) {
    const key = dayKey(item.takenAt ?? item.createdAt, timeZone);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  for (const group of groups) {
    group.title = format.dateTime(new Date(`${group.key}T12:00:00`), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    group.subtitle = tc("photos", { count: group.items.length });
  }
  const cover = items.find((i) => i.id === album.coverMediaId) ?? items.find((i) => i.type === "photo");

  return shell(
    <>
      <p className="mb-3 inline-block origin-left -rotate-2 font-hand text-2xl text-note sm:text-3xl">
        {sharerName ? t("welcomeFrom", { name: sharerName }) : t("welcome")}
      </p>
      <section className="relative mb-8 flex min-h-[280px] items-end overflow-hidden rounded-3xl bg-[#2e241d] text-white sm:min-h-[340px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(cover.id, "large", token)} alt="" className="absolute inset-0 h-full w-full animate-kenburns object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/85 via-[#1c120e]/25 to-transparent" />
        <div className="relative flex w-full flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
          <div className="max-w-2xl">
            {album.note ? <p className="inline-block -rotate-2 font-hand text-3xl text-[#ffd3a8]">{album.note}</p> : null}
            <h1 className="text-balance font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{album.title}</h1>
            <p className="mt-2 text-sm text-white/85">
              {[formatDateRange(locale, album.startDate, album.endDate), tc("items", { count: items.length })].filter(Boolean).join(" · ")}
            </p>
          </div>
          {items.length ? (
            <a href={`/api/albums/${album.id}/zip?share=${encodeURIComponent(token)}`} className="glass inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
              <Download className="size-4" />
              {tc("download")}
            </a>
          ) : null}
        </div>
      </section>
      <MediaGallery groups={groups} shareToken={token} readOnly />
    </>,
  );
}
