"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Brand, UserAvatar } from "@/components/brand";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { adminNav, isActive, mainNav, memoriesNav, type NavItem } from "./nav";

type Props = {
  user: { name: string; image: string | null; role: Role };
  pendingCount: number;
  since?: string;
};

export function AppSidebar({ user, pendingCount, since }: Props) {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const pathname = usePathname();
  const router = useRouter();

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-foreground",
          active && "bg-sidebar-accent text-foreground [&_svg]:text-primary",
        )}
      >
        <item.icon className="size-[18px]" strokeWidth={active ? 2 : 1.7} />
        {t(item.key)}
        {item.key === "family" && pendingCount > 0 ? (
          <span className="ml-auto rounded-md bg-accent px-2 py-1 text-xs font-medium leading-none text-accent-foreground">
            {pendingCount}
          </span>
        ) : null}
      </Link>
    );
  };

  const label = (text: string) => (
    <p className="mb-2 mt-7 px-3 text-xs font-medium tracking-wide text-muted-foreground">{text}</p>
  );

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r bg-sidebar px-4 py-8 lg:flex">
      <Link href="/home" className="mb-10 px-2">
        <Brand since={since} />
      </Link>
      <nav aria-label={t("home")} className="flex flex-col gap-1">{mainNav.map(link)}</nav>
      {label(t("memories"))}
      <nav aria-label={t("memories")} className="flex flex-col gap-1">{memoriesNav.map(link)}</nav>
      {user.role !== "member" ? (
        <>
          {label(t("admin"))}
          <nav aria-label={t("admin")} className="flex flex-col gap-1">{adminNav.map(link)}</nav>
        </>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t pt-5">
        <UserAvatar name={user.name} image={user.image} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground">{tRoles(user.role)}</p>
        </div>
        <Link
          href="/settings"
          aria-label={t("settings")}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <Settings className="size-[18px]" />
        </Link>
        <button
          type="button"
          aria-label={t("signOut")}
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </aside>
  );
}
