"use client";

import { MailCheck, Unlink } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { restartInviteSignUp, resendInviteCode, signUpWithInvite, verifyInviteCode } from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Field, FormHeading, FormMessage, fieldClass } from "./auth-presentation";
import { authErrorMessage } from "./sign-in-form";

/**
 * The invite token from the link, already checked on the server. `pendingEmail` (masked) is set when the account
 * was already made through this link but its email code wasn't entered yet.
 */
export type SignUpInvite = { token: string; valid: boolean; invitedBy: string | null; pendingEmail: string | null };

export function SignUpForm({ invite = null }: { invite?: SignUpInvite | null }) {
  const t = useTranslations("auth");
  const ti = useTranslations("invites");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [values, setValues] = useState({ name: "", username: "", email: "", password: "", relation: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Invite sign-ups: the (masked) email the code went to. Set means the code step is showing.
  const [codeFor, setCodeFor] = useState<string | null>(invite?.valid ? invite.pendingEmail : null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"resend" | "restart" | null>(null);
  const invited = Boolean(invite?.valid);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));

  const actionError = (value: string) =>
    value.startsWith("auth:") ? authErrorMessage(t, value.slice(5)) : te.has(value) ? te(value) : te("unknown");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const email = values.email.trim().toLowerCase();
    const profile = { name: values.name.trim(), email, password: values.password, username: values.username.trim().toLowerCase() };

    try {
      if (invite?.valid) {
        const result = await signUpWithInvite({
          ...profile,
          token: invite.token,
          relationNote: values.relation.trim() || null,
          locale: locale === "id" ? "id" : "en",
        });
        if (!result.ok) {
          setError(actionError(result.error));
          return;
        }
        setCode("");
        setNotice(null);
        setCodeFor(result.data.email);
        if (!result.data.codeSent) setError(ti("codeNotSent"));
        return;
      }

      const result = await authClient.signUp.email({
        ...profile,
        relationNote: values.relation.trim() || undefined,
        locale,
        callbackURL: "/pending",
      });
      if (result.error) {
        setError(authErrorMessage(t, result.error.code));
        return;
      }
      setSentTo(email);
    } catch {
      setError(te("network"));
    } finally {
      setPending(false);
    }
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!invite) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await verifyInviteCode({ token: invite.token, code });
      if (!result.ok) {
        setPending(false);
        setError(actionError(result.error));
        return;
      }
      // A full page load uses the newly set session cookie immediately on phones.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- router.replace after this cookie-setting action left phones stuck on the form
      window.location.assign("/home");
    } catch {
      setPending(false);
      setError(te("network"));
    }
  }

  async function onResend() {
    if (!invite) return;
    setBusy("resend");
    setError(null);
    setNotice(null);
    try {
      const result = await resendInviteCode(invite.token);
      if (!result.ok) {
        setError(actionError(result.error));
        return;
      }
      setCode("");
      setNotice(ti("codeResent"));
    } catch {
      setError(te("network"));
    } finally {
      setBusy(null);
    }
  }

  async function onRestart() {
    if (!invite) return;
    setBusy("restart");
    setError(null);
    setNotice(null);
    try {
      const result = await restartInviteSignUp(invite.token);
      if (!result.ok) {
        setError(actionError(result.error));
        return;
      }
      setCode("");
      setCodeFor(null);
      setValues((v) => ({ ...v, password: "" }));
    } catch {
      setError(te("network"));
    } finally {
      setBusy(null);
    }
  }

  if (invite && !invite.valid) {
    return (
      <div className="flex flex-col gap-6">
        <FormHeading icon={<Unlink />} title={ti("invalidTitle")} lead={ti("invalidText")} />
        <div className="flex flex-col gap-2">
          <Button asChild className="h-12 w-full rounded-lg text-base">
            <Link href="/sign-up">{t("requestAccess")}</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full rounded-lg text-base">
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <FormHeading icon={<MailCheck />} title={t("checkEmailTitle")} lead={t("checkEmailText", { email: sentTo })} />
        <Button asChild variant="outline" className="h-12 w-full rounded-lg text-base">
          <Link href="/">{t("backToStart")}</Link>
        </Button>
      </div>
    );
  }

  if (invited && codeFor) {
    return (
      <form onSubmit={onVerify} className="flex flex-col gap-5" aria-busy={pending || busy !== null}>
        <FormHeading title={ti("codeTitle")} lead={ti("codeLead", { email: codeFor })} />
        <p className="-mt-2 text-sm font-medium text-note">{ti("almostHome")}</p>
        <Field id="code" label={ti("code")} hint={ti("codeHint")}>
          <Input
            id="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            aria-describedby="code-hint"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className={cn(fieldClass, "text-center font-mono text-2xl tracking-[0.4em]")}
          />
        </Field>
        {notice ? <FormMessage>{notice}</FormMessage> : null}
        {error ? <FormMessage error>{error}</FormMessage> : null}
        <Button type="submit" disabled={pending || busy !== null || code.length !== 6} className="mt-1 h-12 rounded-lg text-base">
          {pending ? ti("verifying") : ti("verify")}
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <button
            type="button"
            onClick={onResend}
            disabled={pending || busy !== null}
            className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy === "resend" ? t("sending") : ti("resend")}
          </button>
          <button type="button" onClick={onRestart} disabled={pending || busy !== null} className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">
            {ti("startOver")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <FormHeading
        title={invited ? ti("signUpTitle") : t("requestAccess")}
        lead={invited ? (invite?.invitedBy ? ti("signUpLead", { name: invite.invitedBy }) : ti("signUpLeadAnonymous")) : t("requestLead")}
      />
      <Field id="name" label={t("name")}>
        <Input id="name" required autoComplete="name" value={values.name} onChange={set("name")} className={fieldClass} />
      </Field>
      <Field id="username" label={t("username")} hint={t("usernameHint")}>
        <Input
          id="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_.]+"
          autoComplete="username"
          aria-describedby="username-hint"
          autoCapitalize="none"
          spellCheck={false}
          value={values.username}
          onChange={set("username")}
          className={fieldClass}
        />
      </Field>
      <Field id="email" label={t("email")}>
        <Input id="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} required autoComplete="email" value={values.email} onChange={set("email")} className={fieldClass} />
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint")}>
        <Input id="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="password-hint" value={values.password} onChange={set("password")} className={fieldClass} />
      </Field>
      <Field id="relation" label={t("relation")}>
        <Input id="relation" maxLength={120} value={values.relation} onChange={set("relation")} className={fieldClass} />
      </Field>
      {error ? <FormMessage error>{error}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="mt-1 h-12 rounded-lg text-base">
        {invited ? (pending ? ti("joining") : ti("join")) : pending ? t("sending") : t("sendRequest")}
      </Button>
      <p className="border-t pt-5 text-center text-sm leading-relaxed text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
