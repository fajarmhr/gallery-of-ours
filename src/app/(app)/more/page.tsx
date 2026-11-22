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
    <div className="max-w-2xl">
      <PageHeader title={t("more")} />
      <div className="flex flex-col gap-8">
        {groups.map((group, index) => (
          <section key={index}>
            {group.label ? <h2 className="mb-4 font-display text-2xl font-medium tracking-tight">{group.label}</h2> : null}
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-20 items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <item.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-base font-medium">{t(item.key)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="border-t pt-6">
          <SignOutButton label={t("signOut")} className="h-11 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
