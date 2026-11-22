"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, fieldClass } from "./auth-presentation";

type Translate = ReturnType<typeof useTranslations<"auth">>;

export function authErrorMessage(t: Translate, code: string | undefined) {
  const value = (code ?? "").toUpperCase();
  if (value.includes("NOT_VERIFIED")) return t("emailNotVerified");
  if (value.includes("USERNAME") && (value.includes("TAKEN") || value.includes("EXISTS"))) return t("usernameTaken");
  if (value.includes("ALREADY_EXISTS") || (value.includes("EMAIL") && value.includes("EXIST"))) return t("emailTaken");
  if (value.includes("TOKEN")) return t("invalidToken");
  if (value.includes("INVALID") || value.includes("CREDENTIAL") || value.includes("PASSWORD")) return t("invalidCredentials");
  return t("genericError");
}

export const safeNext = (next: string | undefined) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");

export { fieldClass } from "./auth-presentation";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const id = identifier.trim();
    try {
      const result = id.includes("@")
        ? await authClient.signIn.email({ email: id, password })
        : await authClient.signIn.username({ username: id, password });
      if (result.error) {
        setPending(false);
        setError(authErrorMessage(t, result.error.code));
        return;
      }
      router.push(safeNext(next));
      router.refresh();
    } catch {
      setPending(false);
      setError(t("genericError"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
      {notice ? <FormMessage>{notice}</FormMessage> : null}
      <Field id="identifier" label={t("identifier")}>
        <Input id="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={fieldClass} />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <Label htmlFor="password" className="text-sm font-medium leading-relaxed">{t("password")}</Label>
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
      </div>
      {error ? <FormMessage error>{error}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="mt-1 h-12 rounded-lg text-base">
        {pending ? t("signingIn") : t("signIn")}
      </Button>
      <p className="border-t pt-5 text-center text-sm leading-relaxed text-muted-foreground">
        {t("newHere")}{" "}
        <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("requestAccess")}
        </Link>
      </p>
    </form>
  );
}
