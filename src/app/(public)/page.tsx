import { Lock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { BlankPolaroids } from "@/components/polaroid";
import { LanguageSwitch } from "@/components/preferences";
import { Button } from "@/components/ui/button";

export default async function WelcomePage() {
  const t = await getTranslations("welcome");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Brand />
        <LanguageSwitch compact />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-6 pb-14 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div>
          <p className="inline-block origin-left -rotate-2 font-hand text-3xl text-note">{t("note")}</p>
          <h1 className="mt-2 max-w-[13ch] text-balance font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-[46ch] text-pretty text-lg leading-relaxed text-muted-foreground">{t("text")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-xl px-6 text-base">
              <Link href="/sign-in">{t("signIn")}</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-xl px-6 text-base">
              <Link href="/sign-up">{t("requestAccess")}</Link>
            </Button>
          </div>
          <p className="mt-5 flex max-w-[46ch] items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0 text-note" />
            {t("small")}
          </p>
        </div>
        <BlankPolaroids className="order-first h-[240px] lg:order-none lg:h-[420px]" captions={[t("cap1"), t("cap2"), t("cap3")]} />
      </main>
    </div>
  );
}
