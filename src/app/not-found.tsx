import { MapPinned } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-shell";
import { FormHeading } from "@/components/auth/auth-presentation";
import { PublicShell } from "@/components/auth/public-shell";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <PublicShell mainClassName="flex items-center justify-center">
        <AuthCard>
          <FormHeading icon={<MapPinned />} title={t("title")} lead={t("text")} className="mb-7" />
          <Button asChild className="h-12 w-full rounded-lg px-6 text-base">
            <Link href="/home">{t("home")}</Link>
          </Button>
        </AuthCard>
    </PublicShell>
  );
}
