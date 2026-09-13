import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const email = typeof params.email === "string" ? params.email : "";
  return (
    <>
      <AuthHeading icon={<MailCheck className="size-7" />} title={t("checkEmailTitle")} lead={t("checkEmailText", { email })} />
      <Button asChild variant="outline" className="h-11 w-full rounded-xl">
        <Link href="/sign-in">{t("backToSignIn")}</Link>
      </Button>
    </>
  );
}
