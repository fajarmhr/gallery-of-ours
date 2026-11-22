"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { fieldClass } from "./sign-in-form";
import { Field } from "./sign-up-form";

export function AuthHeadingClient({ title, lead, icon }: { title: string; lead?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-2">
      {icon ? <span className="mb-5 grid size-12 place-items-center rounded-lg bg-accent text-accent-foreground">{icon}</span> : null}
      <h1 className="text-balance font-display text-[2.4rem] font-normal leading-[1.12] tracking-[-0.025em]">{title}</h1>
      {lead ? <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

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
        <AuthHeadingClient icon={<MailCheck className="size-7" />} title={t("resetSentTitle")} lead={t("resetSentText")} />
        <Button asChild variant="outline" className="h-12 rounded-lg">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <AuthHeadingClient title={t("forgotTitle")} lead={t("forgotLead")} />
      <Field id="email" label={t("email")}>
        <Input id="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
      </Field>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="h-12 rounded-lg text-base">
        {pending ? t("sending") : t("sendReset")}
      </Button>
      <Link href="/sign-in" className="text-center text-sm font-semibold text-accent-foreground hover:underline">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
