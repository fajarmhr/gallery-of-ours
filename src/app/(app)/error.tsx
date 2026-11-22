"use client";

import { PageError } from "@/components/page-error";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return <PageError retry={retry} />;
}
