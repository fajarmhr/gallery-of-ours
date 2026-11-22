import { ArrowLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { EmptyState, PageSection } from "@/components/empty-state";
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
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const locale = await getLocale();
  const timeZone = env.timeZone;
  const recap = await getRecap(user.id, year, timeZone);

  const back = (
    <Link href="/recap" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("title")}
    </Link>
  );

  if (!recap) {
    return (
      <>
        {back}
        <EmptyState icon={Sparkles} title={t("emptyTitle")} text={t("emptyText")} headingLevel={1} />
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
      <section className="mb-8 grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[.85fr_1.15fr]">
        <div className="flex flex-col items-start justify-center p-6 sm:p-8">
          <p className="mb-4 text-sm font-medium text-primary">{t("title")}</p>
          <h1 className="font-display text-4xl font-normal leading-[1.08] tracking-tight sm:text-5xl">{t("yearTitle", { year })}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{tc("items", { count: recap.photos + recap.videos })}</p>
          <StoryButton slides={slides} heading={t("yearTitle", { year })} label={t("play")} className="mt-6 h-11 rounded-lg px-5" />
        </div>
        <ThumbhashImage src={mediaUrl(hero.id, "large")} thumbhash={hero.thumbhash} alt={hero.caption ?? hero.albumTitle ?? t("yearTitle", { year })} className="aspect-[4/3] border-t lg:min-h-[320px] lg:border-l lg:border-t-0" eager />
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
        <PageSection title={t("mostLoved")} className="mt-10">
          <MediaGallery groups={[{ key: `loved-${year}`, items: recap.loved }]} />
        </PageSection>
      ) : null}

      <PageSection title={t("highlights")} className="mt-10">
        <MediaGallery groups={[{ key: `highlights-${year}`, items: recap.highlights }]} />
      </PageSection>
    </>
  );
}
