"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function PageError({ retry }: { retry: () => void }) {
  const t = useTranslations("design");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");

  return (
    <EmptyState icon={AlertCircle} title={t("pageErrorTitle")} text={t("pageErrorText")} headingLevel={1}>
      <Button onClick={retry}>{tc("retry")}</Button>
      <Button asChild variant="outline"><Link href="/home">{tn("home")}</Link></Button>
    </EmptyState>
  );
}
