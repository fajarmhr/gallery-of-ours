"use client";

import { MailCheck, Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { signUpWithInvite } from "@/actions/invites";
import { AuthHeadingClient } from "@/components/auth/forgot-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, fieldClass } from "./sign-in-form";

/** The invite token from the link, already checked on the server. */
export type SignUpInvite = { token: string; valid: boolean; invitedBy: string | null };

export function SignUpForm({ invite = null }: { invite?: SignUpInvite | null }) {
  const t = useTranslations("auth");
  const ti = useTranslations("invites");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState({ name: "", username: "", email: "", password: "", relation: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const invited = Boolean(invite?.valid);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const email = values.email.trim().toLowerCase();
    const profile = { name: values.name.trim(), email, password: values.password, username: values.username.trim().toLowerCase() };

    if (invite?.valid) {
      const result = await signUpWithInvite({
        ...profile,
        token: invite.token,
        relationNote: values.relation.trim() || null,
        locale: locale === "id" ? "id" : "en",
      });
      if (!result.ok) {
        setPending(false);
        setError(result.error.startsWith("auth:") ? authErrorMessage(t, result.error.slice(5)) : te.has(result.error) ? te(result.error) : te("unknown"));
        return;
      }
      // Stays "pending" while the next page loads, so the form can't be sent twice.
      router.replace(result.data.signedIn ? "/home" : "/sign-in");
      router.refresh();
      return;
    }

    const result = await authClient.signUp.email({
      ...profile,
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

  if (invite && !invite.valid) {
    return (
      <div>
        <AuthHeadingClient icon={<Unlink className="size-7" />} title={ti("invalidTitle")} lead={ti("invalidText")} />
        <div className="flex flex-col gap-2">
          <Button asChild className="h-11 w-full rounded-xl">
            <Link href="/sign-up">{t("requestAccess")}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full rounded-xl">
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    );
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
      <AuthHeadingClient
        title={invited ? ti("signUpTitle") : t("requestAccess")}
        lead={invited ? (invite?.invitedBy ? ti("signUpLead", { name: invite.invitedBy }) : ti("signUpLeadAnonymous")) : t("requestLead")}
      />
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
        {invited ? (pending ? ti("joining") : ti("join")) : pending ? t("sending") : t("sendRequest")}
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
