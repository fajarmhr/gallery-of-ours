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
  const [loadError, setLoadError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listShareLinks(albumId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLinks(result.data);
        setLoadError(null);
      } else setLoadError(result.error);
    }).catch(() => {
      if (!cancelled) setLoadError("network");
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
    if (pending) return;
    setPending(true);
    const result = await createShareLink(albumId, { expiresInDays: expires, password: password || null }).catch(() => ({ ok: false as const, error: "network" }));
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
          <DialogTitle className="font-display text-2xl font-medium tracking-tight">{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 rounded-xl border bg-muted/35 p-4">
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
                    "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors duration-200",
                    expires === option.value ? "border-primary/30 bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-password">{t("password")}</Label>
            <Input id="share-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-lg" />
            <p className="text-sm leading-relaxed text-muted-foreground">{t("passwordHint")}</p>
          </div>
          <Button onClick={create} disabled={pending} className="h-11 rounded-lg">
            <Link2 />
            {pending ? tc("saving") : t("create")}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-medium">{t("links")}</p>
          {loadError ? <p role="alert" className="text-sm text-destructive">{te.has(loadError) ? te(loadError) : te("unknown")} <button type="button" onClick={reload} className="min-h-11 px-2 font-medium underline underline-offset-4">{tc("retry")}</button></p> : links === null ? <p role="status" className="text-sm text-muted-foreground">{tc("loading")}</p> : null}
          {links && links.length === 0 ? <p className="text-sm text-muted-foreground">{t("noLinks")}</p> : null}
          {links?.map((link) => (
            <div key={link.id} className={cn("flex flex-wrap items-center gap-3 border-t py-4", !link.active && "opacity-60")}>
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
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
                  <Button variant="outline" size="sm" onClick={() => copy(link.url)} className="min-h-11 rounded-lg">
                    <Copy />
                    {tc("copy")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 rounded-lg text-destructive hover:text-destructive"
                    onClick={async () => {
                      const result = await revokeShareLink(link.id).catch(() => ({ ok: false as const, error: "network" }));
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
