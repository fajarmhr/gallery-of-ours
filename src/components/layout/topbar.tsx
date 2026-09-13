"use client";

import { Search, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Brand, UserAvatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/components/upload/upload-context";

export function Topbar({ user }: { user: { name: string; image: string | null } }) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const { open } = useUpload();
  const params = useSearchParams();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Link href="/home" className="lg:hidden">
        <Brand />
      </Link>
      <form action="/search" className="hidden h-10 max-w-md flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/40 md:flex">
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
          className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-foreground/5 md:hidden"
        >
          <Search className="size-5" />
        </Link>
        <Button onClick={() => open()} className="hidden h-10 rounded-xl px-4 sm:inline-flex">
          <Upload />
          {tc("upload")}
        </Button>
        <Link href="/settings" className="lg:hidden" aria-label={user.name}>
          <UserAvatar name={user.name} image={user.image} />
        </Link>
      </div>
    </header>
  );
}
