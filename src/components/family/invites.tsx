"use client";

import { Check, Copy, Link2, MessageCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { createInvite, revokeInvite } from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type InviteItem = {
  id: string;
  url: string;
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedByName: string | null;
  /** "active" once the person entered their email code; "pending" while they still have to. */
  usedByStatus: string | null;
  createdByName: string | null;
};

function useFail() {
  const te = useTranslations("errors");
  return (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));
}

function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const tc = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(tc("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(tc("copy"), url);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy} className={className}>
      {copied ? <Check /> : <Copy />}
      {tc("copy")}
    </Button>
  );
}

export function InviteButton({ days }: { days: number }) {
  const t = useTranslations("invites");
  const tc = useTranslations("common");
  const router = useRouter();
  const fail = useFail();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await createInvite(note);
    setPending(false);
    if (!result.ok) return fail(result.error);
    setLink(result.data.url);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => {
          setNote("");
          setLink(null);
          setOpen(true);
        }}
        className="h-11 rounded-lg px-4"
      >
        <UserPlus />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-medium tracking-tight">{t("title")}</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">{link ? t("ready") : t("text", { days })}</DialogDescription>
          </DialogHeader>

          {link ? (
            <div className="flex flex-col gap-4">
              <p className="flex min-h-12 select-all items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm" title={link}>{link}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <CopyLinkButton url={link} className="h-11 rounded-lg" />
                <Button asChild className="h-11 rounded-lg">
                  <a href={`https://wa.me/?text=${encodeURIComponent(t("message", { url: link }))}`} target="_blank" rel="noreferrer">
                    <MessageCircle />
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <form id="invite-form" onSubmit={create} className="flex flex-col gap-2">
              <Label htmlFor="invite-note">
                {t("forWho")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
              </Label>
              <Input
                id="invite-note"
                maxLength={80}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("forWhoPlaceholder")}
                className="h-12 rounded-lg"
              />
            </form>
          )}

          <DialogFooter>
            {link ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tc("done")}
              </Button>
            ) : (
              <Button type="submit" form="invite-form" disabled={pending}>
                {pending ? tc("saving") : t("create")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvitesList({ invites }: { invites: InviteItem[] }) {
  const t = useTranslations("invites");
  const format = useFormatter();
  const router = useRouter();
  const fail = useFail();
  const [now] = useState(() => Date.now());

  async function revoke(inviteId: string) {
    const result = await revokeInvite(inviteId);
    if (!result.ok) return fail(result.error);
    toast.success(t("revoked"));
    router.refresh();
  }

  if (invites.length === 0) return <p className="rounded-lg bg-muted/40 p-4 text-base leading-relaxed text-muted-foreground">{t("none")}</p>;

  return (
    <ul className="divide-y">
      {invites.map((invite) => {
        const expiresAt = new Date(invite.expiresAt).getTime();
        const usable = !invite.usedAt && expiresAt > now;
        const status = invite.usedAt
          ? invite.usedByStatus === "pending"
            ? t("confirming", { name: invite.usedByName ?? "—" })
            : t("joined", { name: invite.usedByName ?? "—", date: format.dateTime(new Date(invite.usedAt), { dateStyle: "medium" }) })
          : usable
            ? t("expiresIn", { count: Math.max(1, Math.ceil((expiresAt - now) / 86_400_000)) })
            : t("expired");
        return (
          <li key={invite.id} className="flex flex-wrap items-center gap-4 py-5 first:pt-0 last:pb-0">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-lg",
                invite.usedAt ? "bg-olive-soft text-olive" : "bg-muted text-muted-foreground",
              )}
            >
              {invite.usedAt ? <Check className="size-[18px]" /> : <Link2 className="size-[18px]" />}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-base font-medium">{invite.note ?? t("anyone")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {[status, invite.createdByName ? t("by", { name: invite.createdByName }) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {usable ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <CopyLinkButton url={invite.url} className="h-11 flex-1 rounded-lg sm:flex-none" />
                <Button variant="ghost" onClick={() => revoke(invite.id)} className="h-11 rounded-lg text-destructive hover:text-destructive">
                  {t("revoke")}
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
