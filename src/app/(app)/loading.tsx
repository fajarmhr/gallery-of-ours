"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingPage() {
  const t = useTranslations("common");

  return (
    <div role="status" aria-label={t("loading")}>
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true">
        <div className="mb-10 border-b pb-7">
          <Skeleton className="mb-4 h-11 w-48 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <div className="paper-panel">
          <Skeleton className="mb-6 h-7 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
