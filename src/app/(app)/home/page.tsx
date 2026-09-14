import { Cake, Heart, Hourglass, Images, Sparkles, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
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
  const tn = await getTranslations("nav");
  const ts = await getTranslations("story");
  const format = await getFormatter();
  const locale = await getLocale();
  const timeZone = env.timeZone;
  const admin = isAdmin(user);

  const [[albumCount], found, upcoming, recent, pending, years, anniversaries] = await Promise.all([
    db.select({ value: count() }).from(albums).where(isNull(albums.deletedAt)),
    getMemories(user.id, timeZone),
    getUpcoming(60),
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
        <Heading greeting={greeting} title={tn("home")} date={format.dateTime(new Date(), { dateStyle: "full" })} />
        <EmptyState icon={Images} title={t("emptyTitle")} text={t("emptyText")}>
          {(await canCreateAlbum(user)) ? (
            <Button asChild className="h-10 rounded-xl px-5">
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
  const yearsAgo = hero ? yearsSince(dayKey(hero.takenAt!, timeZone), new Date()) : 0;
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
      <Heading greeting={greeting} title={tn("home")} date={format.dateTime(new Date(), { dateStyle: "full" })} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {hero ? (
          <section className="relative flex min-h-[320px] overflow-hidden rounded-3xl bg-[#2e241d] text-white lg:row-span-2">
            <ThumbhashImage src={mediaUrl(hero.id, "large")} thumbhash={hero.thumbhash} className="absolute inset-0" imgClassName="animate-kenburns" eager />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/85 via-[#1c120e]/15 to-transparent" />
            <div className="relative mt-auto flex w-full flex-wrap items-end justify-between gap-4 p-6">
              <div>
                <p className="date-stamp mb-2 text-sm">
                  {filmStamp(hero.takenAt!, timeZone)} · {memoryWhen}
                </p>
                <h2 className="max-w-[18ch] text-balance font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                  {captionOf(hero) ?? hero.albumTitle}
                </h2>
                <p className="mt-2 text-sm text-white/85">
                  {onThisDay
                    ? t("fromAlbum", { album: hero.albumTitle ?? "", count: memories.length })
                    : tm("photos", { album: hero.albumTitle ?? "", count: memories.length })}
                </p>
              </div>
              <StoryButton slides={memorySlides} heading={memoryHeading} label={t("relive")} variant="secondary" />
            </div>
          </section>
        ) : (
          <section className="flex min-h-[220px] flex-col justify-end rounded-3xl border border-dashed bg-card/60 p-6 lg:row-span-2">
            <p className="font-hand text-2xl text-note">{t("onThisDay")}</p>
            <h2 className="font-display text-2xl font-bold">{t("noOnThisDayTitle")}</h2>
            <p className="mt-1 max-w-[46ch] text-muted-foreground">{t("noOnThisDayText")}</p>
          </section>
        )}

        <section className="rounded-3xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">{t("comingUp")}</h2>
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
                      {item.kind === "milestone" && item.repeatsYearly ? ` · ${t("turnsYears", { count: yearsSince(item.originalDate, new Date(item.date)) })}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.kind === "capsule"
                        ? t("capsuleOpens", { date: format.dateTime(new Date(item.date), { dateStyle: "medium" }) })
                        : format.dateTime(new Date(item.date), { day: "numeric", month: "long" })}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-xs font-bold text-accent-foreground">
                    {item.days === 0 ? t("today") : item.days === 1 ? t("tomorrow") : t("inDays", { count: item.days })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {admin ? (
            <Link href="/milestones" className="mt-3 inline-block text-sm font-semibold text-accent-foreground hover:underline">
              {t("addMilestone")}
            </Link>
          ) : null}
        </section>

        {admin && pending.length > 0 ? (
          <section className="rounded-3xl border bg-card p-5">
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
          <Link href={`/recap/${lastYear.year}`} className="group relative flex min-h-[120px] items-end overflow-hidden rounded-3xl bg-[#2e241d] p-5 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(lastYear.coverId, "medium")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/80 to-transparent" />
            <span className="relative inline-flex items-center gap-2 font-display text-xl font-bold">
              <Sparkles className="size-5" />
              {t("recapCta", { year: lastYear.year })}
            </span>
          </Link>
        ) : null}
      </div>

      {milestoneMemories.length > 0 || anniversaries.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold tracking-tight">{t("todayTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {milestoneMemories.map(({ item, photos }) => {
              const cover = photos.at(-1)!;
              const turns = yearsSince(item.originalDate, new Date(item.date));
              const note = turns > 0 ? (item.milestoneKind === "birthday" ? t("milestoneTurns", { count: turns }) : t("milestoneYears", { count: turns })) : undefined;
              const slides: StorySlide[] = [
                { key: "intro", title: item.title, note, meta: t("milestonePhotos", { count: photos.length }), image: mediaUrl(cover.id, "large") },
                ...photos.map((m) => ({
                  key: m.id,
                  image: mediaUrl(m.id, "large"),
                  title: captionOf(m) ?? m.albumTitle ?? item.title,
                  stamp: filmStamp(m.takenAt!, timeZone),
                  meta: [tm("yearsAgo", { count: yearsSince(dayKey(m.takenAt!, timeZone), new Date()) }), m.placeName].filter(Boolean).join(" · "),
                })),
              ];
              return (
                <div key={item.id} className="relative flex min-h-[220px] overflow-hidden rounded-3xl bg-[#2e241d] text-white">
                  <ThumbhashImage src={mediaUrl(cover.id, "medium")} thumbhash={cover.thumbhash} className="absolute inset-0" imgClassName="animate-kenburns" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/85 via-[#1c120e]/20 to-transparent" />
                  <div className="relative mt-auto flex w-full flex-wrap items-end justify-between gap-3 p-5">
                    <div className="min-w-0">
                      {note ? <p className="inline-block origin-left -rotate-2 font-hand text-2xl text-[#ffd3a8]">{note}</p> : null}
                      <h3 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight tracking-tight">
                        {item.milestoneKind === "birthday" ? <Cake className="size-5 shrink-0" /> : <Heart className="size-5 shrink-0" />}
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-white/80">{t("milestonePhotos", { count: photos.length })}</p>
                    </div>
                    <StoryButton slides={slides} heading={item.title} label={t("relive")} variant="secondary" />
                  </div>
                </div>
              );
            })}
            {anniversaries.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`} className="group relative flex min-h-[220px] items-end overflow-hidden rounded-3xl bg-[#2e241d] p-5 text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(album.coverId, "medium")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/85 via-[#1c120e]/20 to-transparent" />
                <span className="relative min-w-0">
                  <span className="date-stamp block text-sm">{t("yearsAgo", { count: yearsSince(album.startDate, new Date()) })}</span>
                  {album.note ? <span className="mt-1 block origin-left -rotate-2 font-hand text-2xl leading-tight text-[#ffd3a8]">{album.note}</span> : null}
                  <span className="block font-display text-2xl font-extrabold leading-tight tracking-tight">{album.title}</span>
                  <span className="mt-1 block text-sm text-white/80">{tc("photos", { count: album.itemCount })}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">{t("recentlyAdded")}</h2>
            <Link href="/timeline" className="text-sm font-semibold text-accent-foreground hover:underline">
              {t("seeAll")}
            </Link>
          </div>
          <MediaGallery groups={[{ key: "recent", items: recent }]} />
        </section>
      ) : null}
    </>
  );
}

function Heading({ greeting, title, date }: { greeting: string; title: string; date: string }) {
  return (
    <div className="mb-6">
      <p className="inline-block origin-left -rotate-2 font-hand text-2xl text-note">{greeting}</p>
      <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{date}</p>
    </div>
  );
}
