import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = params.reset ? t("passwordUpdated") : undefined;
  return (
    <>
      <AuthHeading title={t("welcomeBack")} lead={t("signInLead")} />
      <SignInForm next={next} notice={notice} />
    </>
  );
}
