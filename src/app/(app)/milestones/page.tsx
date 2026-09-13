import { Cake, Heart, Pencil, Plus, Star } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MilestoneDeleteButton, MilestoneDialog } from "@/components/milestones/milestone-dialog";
import { Button } from "@/components/ui/button";
import { daysBetween, nextOccurrence, yearsSince } from "@/lib/format";
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

  const list = (await getMilestones())
    .map((m) => {
      const next = nextOccurrence(m.date, m.repeatsYearly, now);
      return { ...m, next, days: next ? daysBetween(now, next) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.days - b.days);

  const add = admin ? (
    <MilestoneDialog
      trigger={
        <Button className="h-10 rounded-xl px-4">
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((m) => {
            const kind = (m.kind in ICONS ? m.kind : "other") as keyof typeof ICONS;
            const Icon = ICONS[kind];
            const original = new Date(`${m.date}T12:00:00`);
            return (
              <li key={m.id} className="flex items-start gap-3 rounded-3xl border bg-card p-4">
                <span className={kind === "birthday" ? "grid size-11 shrink-0 place-items-center rounded-2xl bg-olive-soft text-olive" : "grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{format.dateTime(original, { dateStyle: "long" })}</p>
                  {m.next ? (
                    <p className="mt-1 text-sm font-semibold text-accent-foreground">
                      {m.repeatsYearly
                        ? t("yearsOn", { count: yearsSince(m.date, m.next), date: format.dateTime(m.next, { day: "numeric", month: "long" }) })
                        : t("nextOn", { date: format.dateTime(m.next, { dateStyle: "medium" }) })}
                      {" · "}
                      {m.days === 0 ? th("today") : m.days === 1 ? th("tomorrow") : th("inDays", { count: m.days })}
                    </p>
                  ) : null}
                </div>
                {admin ? (
                  <div className="flex">
                    <MilestoneDialog
                      milestone={{ id: m.id, title: m.title, date: m.date, kind, repeatsYearly: m.repeatsYearly }}
                      trigger={
                        <button type="button" aria-label={t("edit")} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
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
