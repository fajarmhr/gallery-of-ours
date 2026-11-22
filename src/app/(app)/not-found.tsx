import { MapPinned } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function AppNotFound() {
  const t = await getTranslations("notFound");
  return (
    <EmptyState icon={MapPinned} title={t("title")} text={t("text")} headingLevel={1}>
      <Button asChild><Link href="/home">{t("home")}</Link></Button>
    </EmptyState>
  );
}
