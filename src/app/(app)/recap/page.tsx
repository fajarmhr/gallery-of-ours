import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { env } from "@/lib/env";
import { mediaUrl } from "@/lib/format";
import { getRecapYears } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Year recap" };

export default async function RecapIndexPage() {
  const user = await requireActiveUser();
  const t = await getTranslations("recap");
  const tc = await getTranslations("common");
  const years = await getRecapYears(user.id, env.timeZone);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {years.length === 0 ? (
        <EmptyState icon={Sparkles} title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <div className="grid gap-5 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {years.map((year) => (
            <Link key={year.year} href={`/recap/${year.year}`} aria-label={t("yearTitle", { year: year.year })} className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/35">
              <ThumbhashImage src={mediaUrl(year.coverId, "medium")} className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transform-none" />
              <span className="block border-t p-4 sm:p-5">
                <span className="block font-display text-3xl font-normal leading-tight tracking-tight sm:text-4xl">{year.year}</span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{tc("items", { count: year.count })}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
