"use client";

import { Check, ChevronRight, CloudDownload, Folder, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { browseCloudinaryFolder, importFromCloudinary } from "@/actions/cloudinary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CloudinaryAccountOption, CloudinaryAsset, CloudinaryFolder } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export type { CloudinaryAccountOption };

type Listing = { key: string; folders: CloudinaryFolder[]; assets: (CloudinaryAsset & { added: boolean })[]; error?: string };

const CONCURRENCY = 2;

export function CloudinaryImportDialog({
  albumId,
  accounts,
  open,
  onOpenChange,
}: {
  albumId: string;
  accounts: CloudinaryAccountOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cloudinary");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [path, setPath] = useState("");
  const [reload, setReload] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<Map<string, CloudinaryAsset>>(new Map());
  const [fallbackDate, setFallbackDate] = useState("");
  const [progress, setProgress] = useState<{ finished: number; total: number } | null>(null);

  const key = `${accountId}|${path}|${reload}`;

  useEffect(() => {
    if (!open || !accountId) return;
    let cancelled = false;
    browseCloudinaryFolder(accountId, path)
      .then((result) => {
        if (!cancelled) setListing(result.ok ? { key, ...result.data } : { key, folders: [], assets: [], error: result.error });
      })
      .catch(() => {
        if (!cancelled) setListing({ key, folders: [], assets: [], error: "network" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, accountId, path, key]);

  const ready = listing !== null && listing.key === key ? listing : null;
  const busy = progress !== null;
  const crumbs = path ? path.split("/") : [];
  const selectable = ready ? ready.assets.filter((asset) => !asset.added && !asset.isPrivate) : [];
  const allSelected = selectable.length > 0 && selectable.every((asset) => selected.has(asset.publicId));

  function goTo(next: string) {
    setPath(next);
    setSelected(new Map());
  }

  function toggle(asset: CloudinaryAsset) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(asset.publicId)) next.delete(asset.publicId);
      else next.set(asset.publicId, asset);
      return next;
    });
  }

  async function runImport() {
    const queue = [...selected.values()];
    const total = queue.length;
    let added = 0;
    let failed = 0;
    let lastError = "unknown";
    setProgress({ finished: 0, total });

    const worker = async () => {
      while (queue.length) {
        const asset = queue.shift()!;
        const result = await importFromCloudinary({
          albumId,
          accountId,
          publicId: asset.publicId,
          resourceType: asset.resourceType,
          fallbackDate: fallbackDate || null,
        }).catch(() => ({ ok: false as const, error: "network" }));
        if (result.ok) added += 1;
        else {
          failed += 1;
          lastError = result.error;
        }
        setProgress({ finished: added + failed, total });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    if (added) toast.success(t("done", { count: added }));
    if (failed) toast.error(`${t("someFailed", { count: failed })} ${te.has(lastError) ? te(lastError) : te("unknown")}`);
    setSelected(new Map());
    setProgress(null);
    setReload((n) => n + 1);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 1 ? (
            <Select
              value={accountId}
              disabled={busy}
              onValueChange={(value) => {
                setAccountId(value);
                goTo("");
              }}
            >
              <SelectTrigger className="h-9 w-auto rounded-lg" aria-label={t("account")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <nav aria-label={t("folders")} className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => goTo("")}
              aria-current={path === "" ? "page" : undefined}
              className="rounded-md px-2 py-1 font-semibold hover:bg-foreground/5 aria-[current=page]:text-primary"
            >
              {t("home")}
            </button>
            {crumbs.map((name, index) => {
              const target = crumbs.slice(0, index + 1).join("/");
              return (
                <span key={target} className="flex items-center gap-0.5">
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => goTo(target)}
                    aria-current={target === path ? "page" : undefined}
                    className="rounded-md px-2 py-1 font-semibold hover:bg-foreground/5 aria-[current=page]:text-primary"
                  >
                    {name}
                  </button>
                </span>
              );
            })}
          </nav>
        </div>

        <div className="min-h-[260px] flex-1 overflow-y-auto rounded-2xl border bg-muted/40 p-3">
          {!ready ? (
            <div className="grid min-h-[230px] place-items-center">
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : ready.error ? (
            <p className="p-3 text-sm text-destructive">{te.has(ready.error) && ready.error !== "unknown" ? te(ready.error) : t("loadFailed")}</p>
          ) : ready.folders.length === 0 && ready.assets.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {ready.folders.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {ready.folders.map((folder) => (
                    <button
                      key={folder.path}
                      type="button"
                      disabled={busy}
                      onClick={() => goTo(folder.path)}
                      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-foreground/5"
                    >
                      <Folder className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {ready.assets.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {ready.assets.map((asset) => {
                    const isSelected = selected.has(asset.publicId);
                    const unavailable = asset.added || asset.isPrivate;
                    return (
                      <button
                        key={asset.publicId}
                        type="button"
                        title={asset.name}
                        disabled={busy || unavailable}
                        aria-pressed={isSelected}
                        onClick={() => toggle(asset)}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed",
                          isSelected && "ring-3 ring-primary",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.previewUrl} alt="" loading="lazy" className={cn("size-full object-cover", unavailable && "opacity-40")} />
                        {isSelected ? (
                          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                            <Check className="size-4" />
                          </span>
                        ) : null}
                        {unavailable ? (
                          <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold">
                            {asset.added ? t("added") : t("private")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cloudinary-fallback-date">{t("fallbackDate")}</Label>
            <Input
              id="cloudinary-fallback-date"
              type="date"
              value={fallbackDate}
              disabled={busy}
              onChange={(event) => setFallbackDate(event.target.value)}
              className="h-10 w-44 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">{t("fallbackHint")}</p>
          </div>
          {selectable.length > 0 ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setSelected(allSelected ? new Map() : new Map(selectable.map((asset) => [asset.publicId, asset])))}
            >
              {allSelected ? t("clearSelection") : t("selectAll")}
            </Button>
          ) : null}
        </div>

        {progress ? (
          <div>
            <Progress value={(progress.finished / progress.total) * 100} className="h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">{t("importing", { done: progress.finished, total: progress.total })}</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={busy || selected.size === 0} onClick={runImport} className="rounded-xl">
            {busy ? <LoaderCircle className="animate-spin" /> : <CloudDownload />}
            {t("import", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
