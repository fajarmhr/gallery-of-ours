"use client";

import { Copy, KeyRound, Link2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLinkView } from "@/actions/share";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ShareDialog({ albumId, open, onOpenChange }: { albumId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("share");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [links, setLinks] = useState<ShareLinkView[] | null>(null);
  const [expires, setExpires] = useState<number | null>(30);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listShareLinks(albumId).then((result) => {
      if (!cancelled && result.ok) setLinks(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, albumId, version]);

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(tc("copied"));
    } catch {
      window.prompt(tc("copy"), url);
    }
  }

  async function create() {
    setPending(true);
    const result = await createShareLink(albumId, { expiresInDays: expires, password: password || null });
    setPending(false);
    if (!result.ok) return fail(result.error);
    setPassword("");
    await copy(result.data.url);
    toast.success(t("created"));
    reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 rounded-2xl border bg-background p-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("expires")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 7, label: t("days7") },
                { value: 30, label: t("days30") },
                { value: null, label: t("never") },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={expires === option.value}
                  onClick={() => setExpires(option.value)}
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm font-semibold",
                    expires === option.value ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-password">{t("password")}</Label>
            <Input id="share-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          <Button onClick={create} disabled={pending} className="h-10 rounded-xl">
            <Link2 />
            {t("create")}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-display text-base font-bold">{t("links")}</p>
          {links && links.length === 0 ? <p className="text-sm text-muted-foreground">{t("noLinks")}</p> : null}
          {links?.map((link) => (
            <div key={link.id} className={cn("flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3", !link.active && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{link.url}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {link.active ? (link.expiresAt ? t("expiresOn", { date: format.dateTime(new Date(link.expiresAt), { dateStyle: "medium" }) }) : t("never")) : t("off")}
                  <span>·</span>
                  {t("views", { count: link.viewCount })}
                  {link.hasPassword ? (
                    <span className="inline-flex items-center gap-1">
                      · <KeyRound className="size-3" /> {t("protected")}
                    </span>
                  ) : null}
                </p>
              </div>
              {link.active ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => copy(link.url)} className="rounded-lg">
                    <Copy />
                    {tc("copy")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-lg"
                    onClick={async () => {
                      const result = await revokeShareLink(link.id);
                      if (!result.ok) return fail(result.error);
                      toast.success(t("revoked"));
                      reload();
                    }}
                  >
                    {t("revoke")}
                  </Button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
