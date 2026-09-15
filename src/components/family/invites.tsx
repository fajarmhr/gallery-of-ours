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
        className="h-10 rounded-xl px-4"
      >
        <UserPlus />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">{t("title")}</DialogTitle>
            <DialogDescription>{link ? t("ready") : t("text", { days })}</DialogDescription>
          </DialogHeader>

          {link ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 rounded-xl border bg-muted px-3 py-2">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <CopyLinkButton url={link} className="h-10 rounded-xl" />
                <Button asChild className="h-10 rounded-xl bg-olive text-olive-foreground hover:bg-olive/90">
                  <a href={`https://wa.me/?text=${encodeURIComponent(t("message", { url: link }))}`} target="_blank" rel="noreferrer">
                    <MessageCircle />
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <form id="invite-form" onSubmit={create} className="flex flex-col gap-1.5">
              <Label htmlFor="invite-note">
                {t("forWho")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
              </Label>
              <Input
                id="invite-note"
                maxLength={80}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("forWhoPlaceholder")}
                className="h-11 rounded-xl"
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

  if (invites.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>;

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
          <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl",
                invite.usedAt ? "bg-olive-soft text-olive" : "bg-accent text-accent-foreground",
              )}
            >
              {invite.usedAt ? <Check className="size-[18px]" /> : <Link2 className="size-[18px]" />}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-semibold">{invite.note ?? t("anyone")}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[status, invite.createdByName ? t("by", { name: invite.createdByName }) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {usable ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <CopyLinkButton url={invite.url} className="h-9 flex-1 rounded-lg sm:flex-none" />
                <Button variant="ghost" onClick={() => revoke(invite.id)} className="h-9 rounded-lg text-destructive hover:text-destructive">
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
