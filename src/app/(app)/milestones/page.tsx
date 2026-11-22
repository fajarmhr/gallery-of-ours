import { Cake, Heart, Pencil, Plus, Star } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MilestoneDeleteButton, MilestoneDialog } from "@/components/milestones/milestone-dialog";
import { Button } from "@/components/ui/button";
import { calendarDate, daysBetween, nextOccurrence, yearsSince } from "@/lib/format";
import { env } from "@/lib/env";
import { isAdmin } from "@/lib/permissions";
import { getMilestones } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Milestones" };

const ICONS = { birthday: Cake, anniversary: Heart, other: Star } as const;

export default async function MilestonesPage() {
  const user = await requireActiveUser();
  const admin = isAdmin(user);
  const t = await getTranslations("milestones");
  const th = await getTranslations("home");
  const format = await getFormatter();
  const now = new Date();
  const timeZone = env.timeZone;

  const list = (await getMilestones())
    .map((m) => {
      const next = nextOccurrence(m.date, m.repeatsYearly, now, timeZone);
      return { ...m, next, days: next ? daysBetween(now, next, timeZone) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.days - b.days);

  const add = admin ? (
    <MilestoneDialog
      trigger={
        <Button className="h-11 rounded-lg px-4">
          <Plus />
          {t("new")}
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {add}
      </PageHeader>
      {list.length === 0 ? (
        <EmptyState icon={Cake} title={t("emptyTitle")} text={t("emptyText")}>
          {add}
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((m) => {
            const kind = (m.kind in ICONS ? m.kind : "other") as keyof typeof ICONS;
            const Icon = ICONS[kind];
            const original = calendarDate(m.date, timeZone);
            return (
              <li key={m.id} className="flex flex-wrap items-start gap-4 p-5 sm:items-center sm:p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1 basis-32">
                  <p className="font-display text-2xl font-medium leading-tight [overflow-wrap:anywhere]">{m.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{format.dateTime(original, { dateStyle: "long" })}</p>
                  {m.next ? (
                    <p className="mt-2 text-sm leading-relaxed text-primary">
                      {m.repeatsYearly
                        ? t("yearsOn", { count: yearsSince(m.date, m.next, timeZone), date: format.dateTime(m.next, { day: "numeric", month: "long" }) })
                        : t("nextOn", { date: format.dateTime(m.next, { dateStyle: "medium" }) })}
                      {" · "}
                      {m.days === 0 ? th("today") : m.days === 1 ? th("tomorrow") : th("inDays", { count: m.days })}
                    </p>
                  ) : null}
                </div>
                {admin ? (
                  <div className="ml-auto flex shrink-0">
                    <MilestoneDialog
                      milestone={{ id: m.id, title: m.title, date: m.date, kind, repeatsYearly: m.repeatsYearly }}
                      trigger={
                        <button type="button" aria-label={t("edit")} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Pencil className="size-4" />
                        </button>
                      }
                    />
                    <MilestoneDeleteButton id={m.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
