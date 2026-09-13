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
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
          active && "bg-card text-foreground shadow-sm ring-1 ring-border [&_svg]:text-primary",
        )}
      >
        <item.icon className="size-[18px]" />
        {t(item.key)}
        {item.key === "family" && pendingCount > 0 ? (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold leading-none text-primary-foreground">
            {pendingCount}
          </span>
        ) : null}
      </Link>
    );
  };

  const label = (text: string) => (
    <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{text}</p>
  );

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar px-3 py-5 lg:flex">
      <Link href="/home" className="mb-4 px-3">
        <Brand since={since} />
      </Link>
      <nav className="flex flex-col gap-0.5">{mainNav.map(link)}</nav>
      {label(t("memories"))}
      <nav className="flex flex-col gap-0.5">{memoriesNav.map(link)}</nav>
      {user.role !== "member" ? (
        <>
          {label(t("admin"))}
          <nav className="flex flex-col gap-0.5">{adminNav.map(link)}</nav>
        </>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <UserAvatar name={user.name} image={user.image} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground">{tRoles(user.role)}</p>
        </div>
        <Link
          href="/settings"
          aria-label={t("settings")}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
          className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </aside>
  );
}
