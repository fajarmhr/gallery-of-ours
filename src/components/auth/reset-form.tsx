"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AuthHeadingClient } from "./forgot-form";
import { authErrorMessage, fieldClass } from "./sign-in-form";
import { Field } from "./sign-up-form";

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
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      setError(authErrorMessage(t, result.error.code));
      return;
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <AuthHeadingClient title={t("resetTitle")} lead={t("resetLead")} />
      <Field id="password" label={t("newPassword")}>
        <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} disabled={!token} />
      </Field>
      <Field id="confirm" label={t("confirmPassword")}>
        <Input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} disabled={!token} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !token} className="h-11 rounded-xl text-base">
        {pending ? t("sending") : t("setPassword")}
      </Button>
      <Link href={token ? "/sign-in" : "/forgot-password"} className="text-center text-sm font-semibold text-accent-foreground hover:underline">
        {token ? t("backToSignIn") : t("forgotTitle")}
      </Link>
    </form>
  );
}
