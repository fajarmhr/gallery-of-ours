"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Field, FormHeading, FormMessage, fieldClass } from "./auth-presentation";
import { authErrorMessage } from "./sign-in-form";

export function ResetForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t("invalidToken"));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(authErrorMessage(t, result.error.code));
        return;
      }
      router.push("/sign-in?reset=1");
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      <FormHeading title={t("resetTitle")} lead={t("resetLead")} />
      <Field id="password" label={t("newPassword")}>
        <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} disabled={!token} />
      </Field>
      <Field id="confirm" label={t("confirmPassword")}>
        <Input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} disabled={!token} />
      </Field>
      {error ? <FormMessage error>{error}</FormMessage> : null}
      <Button type="submit" disabled={pending || !token} className="h-12 rounded-lg text-base">
        {pending ? t("sending") : t("setPassword")}
      </Button>
      <Link href={token ? "/sign-in" : "/forgot-password"} className="inline-flex min-h-11 items-center justify-center rounded-sm border-t pt-5 text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        {token ? t("backToSignIn") : t("forgotTitle")}
      </Link>
    </form>
  );
}
