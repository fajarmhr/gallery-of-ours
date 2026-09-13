"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { unlockShareLink } from "@/actions/share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UnlockForm({ token }: { token: string }) {
  const t = useTranslations("share");
  const te = useTranslations("errors");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await unlockShareLink(token, password);
    setPending(false);
    if (!result.ok) {
      setError(te.has(result.error) ? te(result.error) : te("unknown"));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <KeyRound className="size-7" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("enterPassword")}</h1>
        <p className="mt-1 text-muted-foreground">{t("enterPasswordText")}</p>
      </div>
      <Input type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} aria-label={t("password")} className="h-11 rounded-xl" />
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 rounded-xl text-base">
        {t("unlock")}
      </Button>
    </form>
  );
}
