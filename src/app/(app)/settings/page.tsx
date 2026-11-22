import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader, PageSection } from "@/components/empty-state";
import { LanguageSwitch, SignOutButton, ThemeSwitch } from "@/components/preferences";
import { AccountForm } from "@/components/settings/account-form";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireActiveUser();
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");
  const tr = await getTranslations("roles");

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-6">
        <section className="divide-y rounded-xl border bg-card px-6">
          <SettingRow title={t("language")} hint={t("languageHint")}>
            <LanguageSwitch />
          </SettingRow>
          <SettingRow title={t("theme")} hint={t("themeHint")}>
            <ThemeSwitch />
          </SettingRow>
        </section>

        <PageSection title={t("account")} className="paper-panel">
          <AccountForm
            user={{ name: user.name, username: user.username, email: user.email, emailVerified: user.emailVerified, roleLabel: tr(user.role) }}
          />
        </PageSection>

        <section className="paper-panel flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-medium tracking-tight">{t("installTitle")}</h2>
            <p className="mt-2 max-w-[60ch] text-base leading-relaxed text-muted-foreground">{t("installText")}</p>
          </div>
        </section>

        <div className="border-t pt-6">
          <SignOutButton label={tn("signOut")} className="h-11 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-base font-medium">{title}</p>
        <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}
