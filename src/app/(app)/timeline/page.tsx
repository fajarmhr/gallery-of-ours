import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MediaGallery, type MediaGroup } from "@/components/media/media-grid";
import { TimelineModes, YearRail, type TimelineMode } from "@/components/timeline/timeline";
import { env } from "@/lib/env";
import { dayKey } from "@/lib/format";
import { getTimeline } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({ searchParams }: PageProps<"/timeline">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const mode: TimelineMode = params.g === "years" || params.g === "days" ? params.g : "months";
  const t = await getTranslations("timeline");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const timeZone = env.timeZone;

  const items = await getTimeline(user.id, 900);
  const modes = <TimelineModes current={mode} labels={{ years: t("years"), months: t("months"), days: t("days") }} />;

  if (items.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState icon={CalendarDays} title={t("emptyTitle")} text={t("emptyText")} />
      </>
    );
  }

  const groups: MediaGroup[] = [];
  let previousYear = "";
  for (const item of items) {
    const day = dayKey(item.takenAt ?? item.createdAt, timeZone);
    const year = day.slice(0, 4);
    const key = mode === "years" ? year : mode === "months" ? day.slice(0, 7) : day;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, items: [], divider: mode !== "years" && year !== previousYear ? year : undefined };
      groups.push(group);
      previousYear = year;
    }
    group.items.push(item);
  }

  for (const group of groups) {
    const places = [...new Set(group.items.map((i) => i.placeName).filter(Boolean))].slice(0, 3);
    if (mode === "years") {
      group.divider = group.key;
    } else if (mode === "months") {
      group.title = format.dateTime(new Date(`${group.key}-15T12:00:00`), { month: "long", year: "numeric" });
    } else {
      group.title = format.dateTime(new Date(`${group.key}T12:00:00`), { weekday: "long", day: "numeric", month: "long" });
    }
    group.subtitle = [...places, tc("items", { count: group.items.length })].join(" · ");
  }

  const anchors = [...new Set(groups.map((g) => g.key.slice(0, 4)))].map((year) => ({
    year,
    id: `group-${groups.find((g) => g.key.startsWith(year))!.key}`,
  }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {modes}
      </PageHeader>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_64px] lg:gap-6">
        <MediaGallery groups={groups} />
        <YearRail anchors={anchors} />
      </div>
    </>
  );
}
