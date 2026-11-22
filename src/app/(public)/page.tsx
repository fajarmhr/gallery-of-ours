import { Lock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { MemoryKeepsake } from "@/components/auth/memory-keepsake";
import { LanguageSwitch } from "@/components/preferences";
import { Button } from "@/components/ui/button";

export default async function WelcomePage() {
  const t = await getTranslations("welcome");
  const td = await getTranslations("design");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col">
      <a href="#main-content" className="skip-link">{td("skipToContent")}</a>
      <header className="ml-[max(1.5rem,env(safe-area-inset-left))] mr-[max(1.5rem,env(safe-area-inset-right))] flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:ml-[max(2.5rem,env(safe-area-inset-left))] sm:mr-[max(2.5rem,env(safe-area-inset-right))] lg:mx-16">
        <Brand />
        <LanguageSwitch compact />
      </header>
      <main id="main-content" tabIndex={-1} className="grid min-w-0 flex-1 items-center gap-8 pb-12 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-12 outline-none sm:pl-[max(2.5rem,env(safe-area-inset-left))] sm:pr-[max(2.5rem,env(safe-area-inset-right))] sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-14 lg:px-16 lg:py-20">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none">
          <p className="mb-6 text-sm font-medium tracking-wide text-note">{t("note")}</p>
          <h1 className="max-w-[15ch] text-balance font-display text-[clamp(3.1rem,5.5vw,5.4rem)] font-normal leading-[1.04] tracking-[-0.035em]">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-[44ch] text-pretty text-base leading-[1.8] text-muted-foreground sm:text-lg">{t("text")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild className="h-12 rounded-lg px-7 text-base">
              <Link href="/sign-in">{t("signIn")}</Link>
            </Button>
            <Button asChild variant="link" className="h-12 px-0 text-base text-foreground underline-offset-4">
              <Link href="/sign-up">{t("requestAccess")}</Link>
            </Button>
          </div>
          <p className="mt-8 flex max-w-[43ch] items-start gap-2.5 border-t pt-5 text-sm leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-note" />
            {t("small")}
          </p>
        </div>
        <MemoryKeepsake className="animate-in fade-in duration-1000 motion-reduce:animate-none" captions={[t("cap1"), t("cap2"), t("cap3")]} />
      </main>
    </div>
  );
}
