import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { BlankPolaroids } from "@/components/polaroid";
import { LanguageSwitch } from "@/components/preferences";
import { cn } from "@/lib/utils";

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("welcome");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-9">
        <Link href="/">
          <Brand />
        </Link>
        <LanguageSwitch compact />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-5 pb-12 sm:px-9 lg:grid-cols-2 lg:gap-12">
        <BlankPolaroids className="hidden h-[380px] lg:block" captions={[t("cap1"), t("cap2"), t("cap3")]} />
        <div className="flex justify-center lg:justify-end">{children}</div>
      </main>
    </div>
  );
}

export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8", className)}>{children}</div>;
}

export function AuthHeading({ title, lead, icon }: { title: string; lead?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {icon ? <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-olive-soft text-olive">{icon}</span> : null}
      <h1 className="text-balance font-display text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      {lead ? <p className="mt-2 text-pretty text-muted-foreground">{lead}</p> : null}
    </div>
  );
}
