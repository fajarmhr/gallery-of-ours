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
      {icon ? <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-olive-soft text-olive">{icon}</span> : null}
      <h1 className="text-balance font-display text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      {lead ? <p className="mt-2 text-pretty text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    await authClient.requestPasswordReset({ email: email.trim().toLowerCase(), redirectTo: "/reset-password" });
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeadingClient icon={<MailCheck className="size-7" />} title={t("resetSentTitle")} lead={t("resetSentText")} />
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <AuthHeadingClient title={t("forgotTitle")} lead={t("forgotLead")} />
      <Field id="email" label={t("email")}>
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 rounded-xl text-base">
        {pending ? t("sending") : t("sendReset")}
      </Button>
      <Link href="/sign-in" className="text-center text-sm font-semibold text-accent-foreground hover:underline">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
