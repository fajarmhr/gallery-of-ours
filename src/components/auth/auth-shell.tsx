import { getTranslations } from "next-intl/server";
import { MemoryKeepsake } from "@/components/auth/memory-keepsake";
import { cn } from "@/lib/utils";
import { FormHeading } from "./auth-presentation";
import { PublicShell } from "./public-shell";

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("welcome");
  return (
    <PublicShell mainClassName="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <p className="mb-4 text-sm font-medium tracking-wide text-note">{t("note")}</p>
          <h2 className="max-w-[18ch] text-balance font-display text-5xl font-normal leading-[1.08] tracking-[-0.025em]">{t("title")}</h2>
          <MemoryKeepsake className="mt-6 max-w-[390px]" captions={[t("cap1"), t("cap2"), t("cap3")]} />
        </aside>
        <div className="flex min-w-0 justify-center animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none lg:justify-end">{children}</div>
    </PublicShell>
  );
}

export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full min-w-0 max-w-md rounded-xl border bg-card p-6 sm:p-9", className)}>{children}</div>;
}

export function AuthHeading({ title, lead, icon }: { title: string; lead?: string; icon?: React.ReactNode }) {
  return <FormHeading title={title} lead={lead} icon={icon} className="mb-7" />;
}
