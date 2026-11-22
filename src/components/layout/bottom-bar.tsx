"use client";

import { CalendarDays, House, Images, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUpload } from "@/components/upload/upload-context";
import { cn } from "@/lib/utils";
import { isActive } from "./nav";

export function BottomBar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { open } = useUpload();

  const tab = (href: string, label: string, Icon: typeof House) => {
    const active = isActive(pathname, href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground transition-colors",
          active && "text-accent-foreground",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
        {label}
      </Link>
    );
  };

  return (
    <nav aria-label={t("home")} className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center gap-1 border-t bg-background/95 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 backdrop-blur-sm lg:hidden">
      {tab("/home", t("home"), House)}
      {tab("/albums", t("albums"), Images)}
      <button type="button" onClick={() => open()} aria-label={tc("upload")} className="flex min-h-12 items-center justify-center rounded-lg transition-transform active:scale-95">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Plus className="size-6" />
        </span>
      </button>
      {tab("/timeline", t("timeline"), CalendarDays)}
      {tab("/more", t("more"), Menu)}
    </nav>
  );
}
