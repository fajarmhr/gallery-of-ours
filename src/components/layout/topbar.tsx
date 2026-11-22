"use client";

import { LockKeyhole, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Brand, UserAvatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/components/upload/upload-context";

export function Topbar({ user }: { user: { name: string; image: string | null } }) {
  const t = useTranslations("search");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const td = useTranslations("design");
  const { open } = useUpload();
  const params = useSearchParams();

  return (
    <header className="sticky top-0 z-30 flex h-[calc(4.75rem_+_env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b bg-background/95 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-10">
      <Link href="/home" className="flex min-h-11 min-w-0 items-center rounded-sm lg:hidden">
        <Brand />
      </Link>
      <form action="/search" className="hidden h-11 max-w-sm flex-1 items-center gap-2.5 rounded-lg border border-transparent bg-muted/60 px-3 text-muted-foreground focus-within:border-input focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/20 md:flex">
        <Search className="size-4 shrink-0" />
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder={t("placeholder")}
          aria-label={tc("search")}
          className="h-full w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/search"
          aria-label={tc("search")}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 md:hidden"
        >
          <Search className="size-5" />
        </Link>
        <span className="mr-3 hidden items-center gap-1.5 text-xs text-muted-foreground xl:inline-flex"><LockKeyhole className="size-3.5" />{td("familyOnly")}</span>
        <Button onClick={() => open()} className="hidden h-11 rounded-lg px-4 sm:inline-flex">
          <Plus />
          {td("addMemories")}
        </Button>
        <Link href="/settings" className="grid size-11 shrink-0 place-items-center rounded-lg lg:hidden" aria-label={tn("settings")}>
          <UserAvatar name={user.name} image={user.image} />
        </Link>
      </div>
    </header>
  );
}
