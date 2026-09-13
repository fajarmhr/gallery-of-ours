import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/empty-state";
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
    <div className="max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-5">
        <section className="divide-y rounded-3xl border bg-card px-5">
          <SettingRow title={t("language")} hint={t("languageHint")}>
            <LanguageSwitch />
          </SettingRow>
          <SettingRow title={t("theme")} hint={t("themeHint")}>
            <ThemeSwitch />
          </SettingRow>
        </section>

        <section className="rounded-3xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-bold">{t("account")}</h2>
          <AccountForm
            user={{ name: user.name, username: user.username, email: user.email, emailVerified: user.emailVerified, roleLabel: tr(user.role) }}
          />
        </section>

        <section className="flex items-start gap-4 rounded-3xl border bg-card p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Smartphone className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">{t("installTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("installText")}</p>
          </div>
        </section>

        <div>
          <SignOutButton label={tn("signOut")} />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}
