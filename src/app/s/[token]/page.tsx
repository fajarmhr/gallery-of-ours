import { eq, sql } from "drizzle-orm";
import { Download, Images, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { after } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-shell";
import { FormHeading } from "@/components/auth/auth-presentation";
import { PublicShell } from "@/components/auth/public-shell";
import { EmptyState } from "@/components/empty-state";
import { MediaGallery, type MediaGroup } from "@/components/media/media-grid";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { UnlockForm } from "@/components/share/unlock-form";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { shareLinks, user } from "@/db/schema";
import { env } from "@/lib/env";
import { dayKey, formatDateRange, mediaUrl } from "@/lib/format";
import { isAlbumLocked } from "@/lib/permissions";
import { getActiveShareLink, getAlbum, getAlbumMedia, shareCookieName, shareCookieValue } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Shared album", robots: { index: false, follow: false } };

export default async function SharedAlbumPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const t = await getTranslations("share");
  const tc = await getTranslations("common");
  const ta = await getTranslations("albums");
  const format = await getFormatter();
  const locale = await getLocale();

  const link = await getActiveShareLink(token);
  const row = link ? await getAlbum(link.albumId) : null;
  const available = Boolean(link && row && !row.album.deletedAt && !isAlbumLocked(row.album, null));

  const shell = (children: React.ReactNode) => (
    <PublicShell headerNote={t("sharedWithYou")}>{children}</PublicShell>
  );

  if (!available || !link || !row) {
    return shell(
      <div className="mx-auto flex min-h-[55dvh] max-w-md items-center">
        <AuthCard>
          <FormHeading icon={<LinkIcon />} title={t("unavailableTitle")} lead={t("unavailableText")} className="mb-7" />
          <Button asChild variant="outline" className="h-12 w-full rounded-lg text-base"><Link href="/">{tc("back")}</Link></Button>
        </AuthCard>
      </div>,
    );
  }

  if (link.passwordHash) {
    const cookieValue = (await cookies()).get(shareCookieName(token))?.value;
    if (cookieValue !== shareCookieValue(link)) {
      return shell(
        <div className="mx-auto flex min-h-[55dvh] max-w-md items-center">
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
    group.subtitle = tc("items", { count: group.items.length });
  }
  const cover = items.find((i) => i.id === album.coverMediaId && i.type === "photo") ?? items.find((i) => i.type === "photo");

  return shell(
    <>
      <header className={cn("mb-10 grid overflow-hidden rounded-xl border bg-card", cover && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
        {cover ? <div className="relative min-h-64 bg-muted sm:min-h-80 lg:order-2 lg:min-h-96"><ThumbhashImage src={mediaUrl(cover.id, "large", token)} thumbhash={cover.thumbhash} alt={cover.caption ?? album.title} className="absolute inset-0" eager /></div> : null}
        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-9 lg:p-10">
          <p className="mb-5 text-sm font-medium leading-relaxed text-note">{sharerName ? t("welcomeFrom", { name: sharerName }) : t("welcome")}</p>
          <div className="max-w-2xl">
            <h1 className="text-balance font-display text-4xl font-normal leading-[1.06] tracking-[-0.035em] [overflow-wrap:anywhere] sm:text-5xl">{album.title}</h1>
            {album.note ? <p className="mt-4 text-base leading-relaxed text-note">{album.note}</p> : null}
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {[formatDateRange(locale, album.startDate, album.endDate), tc("items", { count: items.length })].filter(Boolean).join(" · ")}
            </p>
            {album.description ? <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{album.description}</p> : null}
          </div>
          {items.length ? (
            <Button asChild className="mt-7 h-12 self-start rounded-lg px-5 text-base"><a href={`/api/albums/${album.id}/zip?share=${encodeURIComponent(token)}`}><Download className="size-4" />{tc("download")}</a></Button>
          ) : null}
        </div>
      </header>
      {items.length ? <MediaGallery groups={groups} shareToken={token} readOnly /> : <EmptyState icon={Images} title={ta("emptyAlbumTitle")} />}
    </>,
  );
}
