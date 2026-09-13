"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { approveUser, rejectUser } from "@/actions/family";
import { UserAvatar } from "@/components/brand";
import { Button } from "@/components/ui/button";

type Request = { id: string; name: string; username: string | null; email: string; relationNote: string | null; createdAt: string };

export function RequestsList({ requests }: { requests: Request[] }) {
  const t = useTranslations("family");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (requests.length === 0) return <p className="text-sm text-muted-foreground">{t("noRequests")}</p>;

  async function decide(request: Request, approve: boolean) {
    setBusy(request.id);
    const result = approve ? await approveUser(request.id) : await rejectUser(request.id);
    setBusy(null);
    if (!result.ok) {
      toast.error(te.has(result.error) ? te(result.error) : te("unknown"));
      return;
    }
    toast.success(approve ? t("approved", { name: request.name }) : t("declined", { name: request.name }));
    router.refresh();
  }

  return (
    <ul className="divide-y">
      {requests.map((request) => (
        <li key={request.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
          <UserAvatar name={request.name} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-semibold">{request.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[request.username ? `@${request.username}` : null, request.email, t("requested", { date: format.relativeTime(new Date(request.createdAt)) })]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {request.relationNote ? <p className="mt-1 text-sm italic">“{request.relationNote}”</p> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy === request.id} onClick={() => decide(request, false)} className="h-9 rounded-lg">
              <X />
              {t("decline")}
            </Button>
            <Button disabled={busy === request.id} onClick={() => decide(request, true)} className="h-9 rounded-lg bg-olive text-olive-foreground hover:bg-olive/90">
              <Check />
              {t("approve")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
