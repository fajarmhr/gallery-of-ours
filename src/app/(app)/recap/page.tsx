import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {years.map((year) => (
            <Link key={year.year} href={`/recap/${year.year}`} className="group relative flex aspect-[4/5] items-end overflow-hidden rounded-3xl bg-[#2e241d] p-4 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(year.coverId, "medium")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#1c120e]/85 via-transparent to-transparent" />
              <span className="relative">
                <span className="block font-display text-5xl font-extrabold leading-none tracking-tight">{year.year}</span>
                <span className="text-sm text-white/85">{tc("items", { count: year.count })}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
