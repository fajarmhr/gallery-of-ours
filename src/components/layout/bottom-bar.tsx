"use client";

import { CalendarDays, House, Images, Menu, Upload } from "lucide-react";
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
          "flex flex-col items-center gap-1 pt-1.5 text-[11px] font-bold text-muted-foreground",
          active && "text-accent-foreground",
        )}
      >
        <Icon className="size-6" />
        {label}
      </Link>
    );
  };

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t bg-sidebar/95 px-2 pt-1 backdrop-blur lg:hidden">
      {tab("/home", t("home"), House)}
      {tab("/albums", t("albums"), Images)}
      <button type="button" onClick={() => open()} aria-label={tc("upload")} className="flex justify-center">
        <span className="-mt-6 grid size-13 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_18px_rgb(180_85_47/0.35)]">
          <Upload className="size-6" />
        </span>
      </button>
      {tab("/timeline", t("timeline"), CalendarDays)}
      {tab("/more", t("more"), Menu)}
    </nav>
  );
}
