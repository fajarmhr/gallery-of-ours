import { ArrowLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { RecapFacts, RecapStats } from "@/components/recap/recap-view";
import { StoryButton, type StorySlide } from "@/components/story/story-player";
import { env } from "@/lib/env";
import { filmStamp, mediaUrl } from "@/lib/format";
import { getRecap } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/recap/[year]">): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} recap` };
}

export default async function RecapYearPage({ params }: PageProps<"/recap/[year]">) {
  const user = await requireActiveUser();
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) notFound();

  const t = await getTranslations("recap");
  const format = await getFormatter();
  const locale = await getLocale();
  const timeZone = env.timeZone;
  const recap = await getRecap(user.id, year, timeZone);

  const back = (
    <Link href="/recap" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("title")}
    </Link>
  );

  if (!recap) {
    return (
      <>
        {back}
        <EmptyState icon={Sparkles} title={t("emptyTitle")} text={t("emptyText")} />
      </>
    );
  }

  const hero = recap.loved[0] ?? recap.highlights[0]!;
  const slides: StorySlide[] = [
    { key: "intro", title: t("storyIntro", { year }), note: "Gallery of Ours", image: mediaUrl(hero.id, "large") },
    ...recap.highlights.map((item) => ({
      key: item.id,
      image: mediaUrl(item.id, "large"),
      title: item.caption ?? (locale === "id" ? item.aiCaption?.id : item.aiCaption?.en) ?? item.placeName ?? item.albumTitle ?? "",
      stamp: filmStamp(item.takenAt ?? item.createdAt, timeZone),
      meta: [item.albumTitle, item.placeName].filter(Boolean).join(" · "),
    })),
    { key: "outro", title: t("storyOutro") },
  ];

  const facts = [
    recap.busiestMonth
      ? { label: t("busiestMonth"), value: format.dateTime(new Date(year, recap.busiestMonth[0] - 1, 15), { month: "long" }) }
      : null,
    recap.topPlace ? { label: t("topPlace"), value: recap.topPlace[0] } : null,
    recap.contributors.length ? { label: t("topContributors"), value: recap.contributors.map(([name]) => name).join(", ") } : null,
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <>
      {back}
      <section className="relative mb-6 flex min-h-[340px] items-end overflow-hidden rounded-3xl bg-[#2e241d] text-white">
        <ThumbhashImage src={mediaUrl(hero.id, "large")} thumbhash={hero.thumbhash} className="absolute inset-0" imgClassName="animate-kenburns" eager />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/90 via-[#1c120e]/25 to-transparent" />
        <div className="relative flex w-full flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
          <div>
            <p className="inline-block -rotate-2 font-hand text-3xl text-[#ffd3a8]">{t("yearTitle", { year })}</p>
            <h1 className="font-display text-7xl font-extrabold leading-none tracking-tighter sm:text-9xl">{year}</h1>
          </div>
          <StoryButton slides={slides} heading={t("yearTitle", { year })} label={t("play")} className="h-11 px-5" />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <RecapStats
          stats={[
            { label: t("photos"), value: recap.photos },
            { label: t("videos"), value: recap.videos },
            { label: t("albums"), value: recap.albums },
            { label: t("places"), value: recap.places },
          ]}
        />
        {facts.length ? <RecapFacts facts={facts} /> : null}
      </div>

      {recap.loved.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold">{t("mostLoved")}</h2>
          <MediaGallery groups={[{ key: `loved-${year}`, items: recap.loved }]} />
        </section>
      ) : null}

      <section className="mt-10">
        <MediaGallery groups={[{ key: `highlights-${year}`, items: recap.highlights }]} />
      </section>
    </>
  );
}
