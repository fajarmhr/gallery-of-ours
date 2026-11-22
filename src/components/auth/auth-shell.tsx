import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { MemoryKeepsake } from "@/components/auth/memory-keepsake";
import { LanguageSwitch } from "@/components/preferences";
import { cn } from "@/lib/utils";

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("welcome");
  const td = await getTranslations("design");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col">
      <a href="#main-content" className="skip-link">{td("skipToContent")}</a>
      <header className="ml-[max(1.5rem,env(safe-area-inset-left))] mr-[max(1.5rem,env(safe-area-inset-right))] flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:ml-[max(2.5rem,env(safe-area-inset-left))] sm:mr-[max(2.5rem,env(safe-area-inset-right))] lg:mx-16">
        <Link href="/" className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Brand />
        </Link>
        <LanguageSwitch compact />
      </header>
      <main id="main-content" tabIndex={-1} className="grid min-w-0 flex-1 items-center gap-10 py-10 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] outline-none sm:pl-[max(2.5rem,env(safe-area-inset-left))] sm:pr-[max(2.5rem,env(safe-area-inset-right))] sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-16">
        <aside className="hidden lg:block">
          <p className="mb-4 text-sm font-medium tracking-wide text-note">{t("note")}</p>
          <h2 className="max-w-[18ch] text-balance font-display text-5xl font-normal leading-[1.08] tracking-[-0.025em]">{t("title")}</h2>
          <MemoryKeepsake className="mt-6 max-w-[390px]" captions={[t("cap1"), t("cap2"), t("cap3")]} />
        </aside>
        <div className="flex min-w-0 justify-center animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none lg:justify-end">{children}</div>
      </main>
    </div>
  );
}

export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full min-w-0 max-w-md rounded-xl border bg-card p-6 sm:p-9", className)}>{children}</div>;
}

export function AuthHeading({ title, lead, icon }: { title: string; lead?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-7">
      {icon ? <span className="mb-5 grid size-12 place-items-center rounded-lg bg-accent text-accent-foreground">{icon}</span> : null}
      <h1 className="text-balance font-display text-[2.4rem] font-normal leading-[1.12] tracking-[-0.025em]">{title}</h1>
      {lead ? <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}
