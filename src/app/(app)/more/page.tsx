import { ChevronRight, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/empty-state";
import { adminNav, mainNav, memoriesNav } from "@/components/layout/nav";
import { SignOutButton } from "@/components/preferences";
import { isAdmin } from "@/lib/permissions";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const user = await requireActiveUser();
  const t = await getTranslations("nav");
  const groups = [
    { label: null, items: mainNav.filter((item) => !["/home", "/albums", "/timeline"].includes(item.href)) },
    { label: t("memories"), items: memoriesNav },
    ...(isAdmin(user) ? [{ label: t("admin"), items: adminNav }] : []),
    { label: null, items: [{ href: "/settings", key: "settings", icon: Settings }] },
  ];

  return (
    <div className="max-w-xl">
      <PageHeader title={t("more")} />
      <div className="flex flex-col gap-5">
        {groups.map((group, index) => (
          <section key={index}>
            {group.label ? <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p> : null}
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/5">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <item.icon className="size-[18px]" />
                    </span>
                    <span className="flex-1 font-semibold">{t(item.key)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <SignOutButton label={t("signOut")} className="self-start" />
      </div>
    </div>
  );
}
