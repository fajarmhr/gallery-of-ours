"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Field, FormHeading, FormMessage, fieldClass } from "./auth-presentation";

export function ForgotForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({ email: email.trim().toLowerCase(), redirectTo: "/reset-password" });
      if (result.error) {
        setError(t("genericError"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <FormHeading icon={<MailCheck />} title={t("resetSentTitle")} lead={t("resetSentText")} />
        <Button asChild variant="outline" className="h-12 rounded-lg text-base">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <FormHeading title={t("forgotTitle")} lead={t("forgotLead")} />
      <Field id="email" label={t("email")}>
        <Input id="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
      </Field>
      {error ? <FormMessage error>{error}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="h-12 rounded-lg text-base">
        {pending ? t("sending") : t("sendReset")}
      </Button>
      <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center rounded-sm border-t pt-5 text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
