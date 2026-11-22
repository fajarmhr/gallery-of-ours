import { MapPinned } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6">
      <header className="border-b py-7">
        <Link href="/" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Brand /></Link>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center py-12">
        <EmptyState icon={MapPinned} title={t("title")} text={t("text")} className="w-full max-w-xl border-solid">
          <Button asChild className="h-12 rounded-lg px-6">
            <Link href="/home">{t("home")}</Link>
          </Button>
        </EmptyState>
      </main>
    </div>
  );
}
