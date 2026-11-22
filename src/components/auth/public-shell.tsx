import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/preferences";
import { cn } from "@/lib/utils";

/** Shared page frame for visitors, account screens, and privately shared albums. */
export async function PublicShell({ children, mainClassName, headerNote }: { children: ReactNode; mainClassName?: string; headerNote?: string }) {
  const t = await getTranslations("design");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col">
      <a href="#main-content" className="skip-link">{t("skipToContent")}</a>
      <header className="ml-[max(1.5rem,env(safe-area-inset-left))] mr-[max(1.5rem,env(safe-area-inset-right))] flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:ml-[max(2.5rem,env(safe-area-inset-left))] sm:mr-[max(2.5rem,env(safe-area-inset-right))] lg:mx-16">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Brand />
          </Link>
          {headerNote ? <span className="hidden border-l pl-5 text-sm leading-relaxed text-muted-foreground md:block">{headerNote}</span> : null}
        </div>
        <LanguageSwitch compact />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full min-w-0 flex-1 py-10 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] outline-none sm:py-14 sm:pl-[max(2.5rem,env(safe-area-inset-left))] sm:pr-[max(2.5rem,env(safe-area-inset-right))] lg:px-16",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
