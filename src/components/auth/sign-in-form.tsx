"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

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

export const fieldClass = "h-11 rounded-xl bg-background text-base";

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
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {notice ? <p className="rounded-xl bg-olive-soft px-3 py-2 text-sm font-medium text-olive">{notice}</p> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">{t("identifier")}</Label>
        <Input id="identifier" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Link href="/forgot-password" className="text-sm font-semibold text-accent-foreground hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1 h-11 rounded-xl text-base">
        {pending ? t("signingIn") : t("signIn")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("newHere")}{" "}
        <Link href="/sign-up" className="font-semibold text-accent-foreground hover:underline">
          {t("requestAccess")}
        </Link>
      </p>
    </form>
  );
}
