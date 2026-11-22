"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { PageError } from "@/components/page-error";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-[max(1.25rem,env(safe-area-inset-left))] py-[max(2rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))]">
      <Link href="/home" className="mb-8 self-center rounded-sm"><Brand /></Link>
      <PageError retry={retry} />
    </main>
  );
}
