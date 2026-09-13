import { MapPinned } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl items-center px-5">
      <EmptyState icon={MapPinned} title={t("title")} text={t("text")} className="w-full">
        <Button asChild className="h-10 rounded-xl px-5">
          <Link href="/home">{t("home")}</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
