"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AuthHeadingClient } from "@/components/auth/forgot-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, fieldClass } from "./sign-in-form";

export function SignUpForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [values, setValues] = useState({ name: "", username: "", email: "", password: "", relation: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const email = values.email.trim().toLowerCase();
    const result = await authClient.signUp.email({
      name: values.name.trim(),
      email,
      password: values.password,
      username: values.username.trim().toLowerCase(),
      relationNote: values.relation.trim() || undefined,
      locale,
      callbackURL: "/pending",
    });
    setPending(false);
    if (result.error) {
      setError(authErrorMessage(t, result.error.code));
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div>
        <AuthHeadingClient icon={<MailCheck className="size-7" />} title={t("checkEmailTitle")} lead={t("checkEmailText", { email: sentTo })} />
        <Button asChild variant="outline" className="h-11 w-full rounded-xl">
          <Link href="/">{t("backToStart")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <AuthHeadingClient title={t("requestAccess")} lead={t("requestLead")} />
      <Field id="name" label={t("name")}>
        <Input id="name" required autoComplete="name" placeholder={t("namePlaceholder")} value={values.name} onChange={set("name")} className={fieldClass} />
      </Field>
      <Field id="username" label={t("username")} hint={t("usernameHint")}>
        <Input
          id="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_.]+"
          autoComplete="username"
          value={values.username}
          onChange={set("username")}
          className={fieldClass}
        />
      </Field>
      <Field id="email" label={t("email")}>
        <Input id="email" type="email" required autoComplete="email" value={values.email} onChange={set("email")} className={fieldClass} />
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint")}>
        <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={values.password} onChange={set("password")} className={fieldClass} />
      </Field>
      <Field id="relation" label={t("relation")}>
        <Input id="relation" maxLength={120} placeholder={t("relationPlaceholder")} value={values.relation} onChange={set("relation")} className={fieldClass} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1 h-11 rounded-xl text-base">
        {pending ? t("sending") : t("sendRequest")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-semibold text-accent-foreground hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
