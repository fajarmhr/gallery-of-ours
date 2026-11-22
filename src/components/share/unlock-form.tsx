"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { unlockShareLink } from "@/actions/share";
import { Field, FormHeading, FormMessage, fieldClass } from "@/components/auth/auth-presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UnlockForm({ token }: { token: string }) {
  const t = useTranslations("share");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await unlockShareLink(token, password);
      if (!result.ok) {
        setError(te.has(result.error) ? te(result.error) : te("unknown"));
        return;
      }
      router.refresh();
    } catch {
      setError(te("network"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={pending}>
      <FormHeading icon={<KeyRound />} title={t("enterPassword")} lead={t("enterPasswordText")} />
      <Field id="share-password" label={t("password")}>
        <Input id="share-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "share-password-error" : undefined} className={fieldClass} />
      </Field>
      {error ? <FormMessage error id="share-password-error">{error}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="h-12 rounded-lg text-base">
        {pending ? tc("loading") : t("unlock")}
      </Button>
    </form>
  );
}
