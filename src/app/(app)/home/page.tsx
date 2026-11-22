import { Cake, Heart, Hourglass, Images, Sparkles, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, PageSection } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { StoryButton, type StorySlide } from "@/components/story/story-player";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { albums } from "@/db/schema";
import { count, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { dayKey, filmStamp, mediaUrl, yearsSince } from "@/lib/format";
import { canCreateAlbum, isAdmin } from "@/lib/permissions";
import {
  getAlbumAnniversaries,
  getDayMemories,
  getMemories,
  getPendingUsers,
  getRecapYears,
  getRecentMedia,
  getUpcoming,
  type MediaCard,
  type UpcomingItem,
} from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

type MilestoneItem = Extract<UpcomingItem, { kind: "milestone" }>;

export default async function HomePage() {
  const user = await requireActiveUser();
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tm = await getTranslations("memories");
  const ts = await getTranslations("story");
  const td = await getTranslations("design");
  const format = await getFormatter();
  const locale = await getLocale();
  const timeZone = env.timeZone;
  const admin = isAdmin(user);

  const [[albumCount], found, upcoming, recent, pending, years, anniversaries] = await Promise.all([
    db.select({ value: count() }).from(albums).where(isNull(albums.deletedAt)),
    getMemories(user.id, timeZone),
    getUpcoming(60, timeZone),
    getRecentMedia(user.id, 10),
    admin ? getPendingUsers() : Promise.resolve([]),
    getRecapYears(user.id, timeZone),
    getAlbumAnniversaries(user.id, timeZone),
  ]);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const firstName = user.name.split(" ")[0] ?? user.name;
  const greeting = hour < 11 ? t("greetingMorning", { name: firstName }) : hour < 17 ? t("greetingAfternoon", { name: firstName }) : t("greetingEvening", { name: firstName });

  if ((albumCount?.value ?? 0) === 0) {
    return (
      <>
        <Heading greeting={greeting} title={td("homeTitle")} date={format.dateTime(new Date(), { dateStyle: "full" })} />
        <EmptyState icon={Images} title={t("emptyTitle")} text={t("emptyText")}>
          {(await canCreateAlbum(user)) ? (
            <Button asChild className="h-11 rounded-lg px-5">
              <Link href="/albums">{t("createFirstAlbum")}</Link>
            </Button>
          ) : null}
        </EmptyState>
      </>
    );
  }

  const captionOf = (m: MediaCard) => m.caption ?? (locale === "id" ? m.aiCaption?.id : m.aiCaption?.en) ?? null;

  // The hero shows one year at a time: the newest year among the memories found.
  const newestYear = found.items[0] ? dayKey(found.items[0].takenAt!, timeZone).slice(0, 4) : null;
  const memories = newestYear ? found.items.filter((m) => dayKey(m.takenAt!, timeZone).startsWith(newestYear)) : [];
  const hero = memories[0];
  const yearsAgo = hero ? yearsSince(dayKey(hero.takenAt!, timeZone), new Date(), timeZone) : 0;
  const onThisDay = found.level === "day";
  const memoryHeading = onThisDay ? ts("onThisDay") : tm(found.level);
  const memoryWhen = onThisDay
    ? t("yearsAgo", { count: yearsAgo })
    : [tm(found.level), yearsAgo > 0 ? tm("yearsAgo", { count: yearsAgo }) : null].filter(Boolean).join(" · ");
  const memorySlides: StorySlide[] = memories.map((m) => ({
    key: m.id,
    image: mediaUrl(m.id, "large"),
    title: captionOf(m) ?? m.albumTitle ?? "",
    stamp: filmStamp(m.takenAt!, timeZone),
    meta: [m.placeName, m.uploaderName].filter(Boolean).join(" · "),
  }));
  const lastYear = years.find((y) => y.year === new Date().getFullYear() - 1) ?? years.find((y) => y.year < new Date().getFullYear());

  // A yearly milestone happening today brings back the photos taken on its date in earlier years.
  const milestonesToday = upcoming
    .filter((item): item is MilestoneItem => item.kind === "milestone" && item.repeatsYearly && item.days === 0)
    .slice(0, 2);
  const milestoneMemories = (
    await Promise.all(milestonesToday.map(async (item) => ({ item, photos: await getDayMemories(user.id, item.originalDate.slice(5), timeZone) })))
  ).filter((entry) => entry.photos.length > 0);

  return (
    <>
      <Heading greeting={greeting} title={td("homeTitle")} date={format.dateTime(new Date(), { dateStyle: "full" })} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {hero ? (
          <section className="flex flex-col overflow-hidden rounded-xl border bg-card xl:row-span-2">
            <div className="relative min-h-60 flex-1 sm:min-h-72">
              <ThumbhashImage src={mediaUrl(hero.id, "large")} alt={captionOf(hero) ?? hero.albumTitle ?? memoryHeading} thumbhash={hero.thumbhash} className="absolute inset-0" eager />
              <span className="absolute left-4 top-4 rounded-md bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground">{memoryHeading}</span>
            </div>
            <div className="flex w-full flex-wrap items-end justify-between gap-5 p-5 sm:p-6">
              <div className="min-w-0 flex-1 basis-56">
                <p className="mb-2 text-xs font-medium tracking-wide text-note">
                  {memoryWhen} · {filmStamp(hero.takenAt!, timeZone)}
                </p>
                <h2 className="text-balance font-display text-[1.9rem] font-medium leading-[1.15] tracking-tight sm:text-4xl">
                  {captionOf(hero) ?? hero.albumTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {onThisDay
                    ? t("fromAlbum", { album: hero.albumTitle ?? "", count: memories.length })
                    : tm("photos", { album: hero.albumTitle ?? "", count: memories.length })}
                </p>
              </div>
              <StoryButton slides={memorySlides} heading={memoryHeading} label={t("relive")} variant="secondary" />
            </div>
          </section>
        ) : (
          <section className="flex min-h-[300px] flex-col justify-end rounded-xl border bg-card p-7 xl:row-span-2">
            <Heart className="mb-auto size-8 text-primary" strokeWidth={1.2} />
            <p className="mb-3 mt-8 text-sm text-note">{t("onThisDay")}</p>
            <h2 className="font-display text-3xl font-medium">{t("noOnThisDayTitle")}</h2>
            <p className="mt-1 max-w-[46ch] text-muted-foreground">{t("noOnThisDayText")}</p>
          </section>
        )}

        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="mb-5 font-display text-2xl font-medium">{t("comingUp")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nothingComingUp")}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 4).map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={item.kind === "capsule" ? "grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground" : "grid size-9 shrink-0 place-items-center rounded-xl bg-olive-soft text-olive"}>
                    {item.kind === "capsule" ? <Hourglass className="size-[18px]" /> : item.milestoneKind === "birthday" ? <Cake className="size-[18px]" /> : <Heart className="size-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">
                      {item.title}
                      {item.kind === "milestone" && item.repeatsYearly ? ` · ${t("turnsYears", { count: yearsSince(item.originalDate, new Date(item.date), timeZone) })}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.kind === "capsule"
                        ? t("capsuleOpens", { date: format.dateTime(new Date(item.date), { dateStyle: "medium" }) })
                        : format.dateTime(new Date(item.date), { day: "numeric", month: "long" })}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-accent-foreground">
                    {item.days === 0 ? t("today") : item.days === 1 ? t("tomorrow") : t("inDays", { count: item.days })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {admin ? (
            <Link href="/milestones" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              {t("addMilestone")}
            </Link>
          ) : null}
        </section>

        {admin && pending.length > 0 ? (
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-olive-soft text-olive">
                <UserCheck className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-semibold">{t("newSignups")}</p>
                <p className="truncate text-xs text-muted-foreground">{pending.map((p) => p.name).join(", ")}</p>
              </div>
              <Button asChild size="sm" className="rounded-lg">
                <Link href="/family">{t("review")}</Link>
              </Button>
            </div>
          </section>
        ) : lastYear ? (
          <Link href={`/recap/${lastYear.year}`} className="group flex min-h-[140px] items-center gap-5 overflow-hidden rounded-xl border bg-card p-5">
            <ThumbhashImage src={mediaUrl(lastYear.coverId, "medium")} className="size-24 shrink-0 -rotate-3 border-4 border-print transition-transform duration-500 group-hover:rotate-0 motion-reduce:transform-none" />
            <span className="inline-flex flex-col gap-2 font-display text-2xl font-medium leading-tight">
              <Sparkles className="size-4 text-note" />
              {t("recapCta", { year: lastYear.year })}
            </span>
          </Link>
        ) : null}
      </div>

      {milestoneMemories.length > 0 || anniversaries.length > 0 ? (
        <PageSection className="mt-10" title={t("todayTitle")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {milestoneMemories.map(({ item, photos }) => {
              const cover = photos.at(-1)!;
              const turns = yearsSince(item.originalDate, new Date(item.date), timeZone);
              const note = turns > 0 ? (item.milestoneKind === "birthday" ? t("milestoneTurns", { count: turns }) : t("milestoneYears", { count: turns })) : undefined;
              const slides: StorySlide[] = [
                { key: "intro", title: item.title, note, meta: t("milestonePhotos", { count: photos.length }), image: mediaUrl(cover.id, "large") },
                ...photos.map((m) => ({
                  key: m.id,
                  image: mediaUrl(m.id, "large"),
                  title: captionOf(m) ?? m.albumTitle ?? item.title,
                  stamp: filmStamp(m.takenAt!, timeZone),
                  meta: [tm("yearsAgo", { count: yearsSince(dayKey(m.takenAt!, timeZone), new Date(), timeZone) }), m.placeName].filter(Boolean).join(" · "),
                })),
              ];
              return (
                <div key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
                  <ThumbhashImage src={mediaUrl(cover.id, "medium")} alt={item.title} thumbhash={cover.thumbhash} className="aspect-[16/9] w-full" />
                  <div className="flex w-full flex-wrap items-end justify-between gap-4 p-5">
                    <div className="min-w-0">
                      {note ? <p className="mb-2 text-sm font-medium text-note">{note}</p> : null}
                      <h3 className="flex items-center gap-2 font-display text-2xl font-medium leading-tight tracking-tight">
                        {item.milestoneKind === "birthday" ? <Cake className="size-5 shrink-0" /> : <Heart className="size-5 shrink-0" />}
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">{t("milestonePhotos", { count: photos.length })}</p>
                    </div>
                    <StoryButton slides={slides} heading={item.title} label={t("relive")} variant="secondary" />
                  </div>
                </div>
              );
            })}
            {anniversaries.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/35">
                <ThumbhashImage src={mediaUrl(album.coverId, "medium")} alt={album.title} className="aspect-[16/9] w-full" imgClassName="transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transform-none" />
                <span className="min-w-0 p-5">
                  <span className="block text-sm font-medium text-note">{t("yearsAgo", { count: yearsSince(album.startDate, new Date(), timeZone) })}</span>
                  {album.note ? <span className="mt-2 block text-sm text-muted-foreground">{album.note}</span> : null}
                  <span className="mt-2 block font-display text-2xl font-medium leading-tight tracking-tight">{album.title}</span>
                  <span className="mt-2 block text-sm text-muted-foreground">{tc("photos", { count: album.itemCount })}</span>
                </span>
              </Link>
            ))}
          </div>
        </PageSection>
      ) : null}

      {recent.length > 0 ? (
        <PageSection className="mt-10" title={t("recentlyAdded")} action={
            <Link href="/timeline" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              {t("seeAll")}
            </Link>
        }>
          <MediaGallery groups={[{ key: "recent", items: recent }]} />
        </PageSection>
      ) : null}
    </>
  );
}

function Heading({ greeting, title, date }: { greeting: string; title: string; date: string }) {
  return (
    <PageHeader note={greeting} title={title}>
      <p className="pb-1 text-sm text-muted-foreground">{date}</p>
    </PageHeader>
  );
}
