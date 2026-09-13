"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { setLocale } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const segment = "inline-flex flex-wrap gap-1 rounded-xl border bg-card p-1";
const option = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60",
    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
  );

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: "en" | "id") =>
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });

  return (
    <div role="group" aria-label="Language" className={segment}>
      {(["en", "id"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={locale === value}
          disabled={pending}
          onClick={() => change(value)}
          className={cn(option(locale === value), compact && "px-2.5 text-xs")}
        >
          {compact ? value.toUpperCase() : value === "en" ? "English" : "Bahasa Indonesia"}
        </button>
      ))}
    </div>
  );
}

export function ThemeSwitch() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const options = [
    { value: "system", label: t("device"), icon: Monitor },
    { value: "light", label: t("light"), icon: Sun },
    { value: "dark", label: t("dark"), icon: Moon },
  ];

  return (
    <div role="group" aria-label={t("theme")} className={segment}>
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && (theme ?? "system") === value;
        return (
          <button key={value} type="button" aria-pressed={active} onClick={() => setTheme(value)} className={option(active)}>
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SignOutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-10 rounded-xl px-4", className)}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        })
      }
    >
      <LogOut />
      {label}
    </Button>
  );
}
