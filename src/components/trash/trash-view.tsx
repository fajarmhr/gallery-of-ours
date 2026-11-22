"use client";

import { Check, Play, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { deleteForever, restoreFromTrash } from "@/actions/trash";
import { PageSection } from "@/components/empty-state";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { daysBetween, mediaUrl, TRASH_DAYS } from "@/lib/format";
import { cn } from "@/lib/utils";

type TrashAlbum = { id: string; title: string; deletedAt: string; itemCount: number };
type TrashMedia = { id: string; type: string; thumbhash: string | null; deletedAt: string; albumTitle: string };
type Target = { mediaIds?: string[]; albumIds?: string[] };

export function TrashView({ albums, media }: { albums: TrashAlbum[]; media: TrashMedia[] }) {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Target | null>(null);

  const daysLeft = (iso: string) => Math.max(0, TRASH_DAYS - daysBetween(new Date(iso), new Date()));
  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function restore(target: Target) {
    const result = await restoreFromTrash(target);
    if (!result.ok) return fail(result.error);
    toast.success(t("restored"));
    setSelected(new Set());
    router.refresh();
  }

  async function destroy(target: Target) {
    const result = await deleteForever(target);
    if (!result.ok) return fail(result.error);
    toast.success(t("deleted"));
    setSelected(new Set());
    setConfirm(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10 pb-24">
      {albums.length > 0 ? (
        <PageSection title={t("albums")}>
          <ul className="divide-y rounded-xl border bg-card">
            {albums.map((album) => (
              <li key={album.id} className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <p className="text-base font-medium [overflow-wrap:anywhere]">{album.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tc("items", { count: album.itemCount })} · {t("daysLeft", { count: daysLeft(album.deletedAt) })}
                  </p>
                </div>
                <Button variant="outline" onClick={() => restore({ albumIds: [album.id] })} className="h-11 rounded-lg">
                  <RotateCcw />
                  {t("restore")}
                </Button>
                <Button variant="destructive" onClick={() => setConfirm({ albumIds: [album.id] })} className="h-11 rounded-lg">
                  <Trash2 />
                  {t("deleteForever")}
                </Button>
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}

      {media.length > 0 ? (
        <PageSection title={t("items")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {media.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${item.albumTitle} · ${t("daysLeft", { count: daysLeft(item.deletedAt) })}`}
                  onClick={() => toggle(item.id)}
                  className={cn("group min-w-0 overflow-hidden rounded-xl border bg-card text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring", isSelected ? "border-primary ring-2 ring-primary" : "hover:border-primary/40")}
                >
                  <span className="relative block aspect-square overflow-hidden bg-muted">
                    <ThumbhashImage src={mediaUrl(item.id, "thumb")} thumbhash={item.thumbhash} className="h-full w-full" imgClassName={cn(isSelected && "opacity-80")} />
                    {item.type === "video" ? <Play className="absolute left-3 top-3 size-5 fill-white text-white drop-shadow" /> : null}
                    <span className={cn("absolute right-3 top-3 grid size-6 place-items-center rounded-md border border-white/90 text-white", isSelected ? "bg-primary" : "bg-black/20")}>
                      {isSelected ? <Check className="size-4" /> : null}
                    </span>
                  </span>
                  <span className="block p-3">
                    <span className="block truncate text-sm font-medium">{item.albumTitle}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("daysLeft", { count: daysLeft(item.deletedAt) })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </PageSection>
      ) : null}

      {selected.size > 0 ? (
        <div role="region" aria-label={tc("selected", { count: selected.size })} className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border bg-card p-4 shadow-[0_2px_8px_rgb(70_45_25/0.04)] lg:bottom-6">
          <span className="mr-auto text-sm font-medium">{tc("selected", { count: selected.size })}</span>
          <Button variant="ghost" onClick={() => setSelected(new Set())} className="h-11 rounded-lg">
            {tc("clearSelection")}
          </Button>
          <Button variant="outline" onClick={() => restore({ mediaIds: [...selected] })} className="h-11 rounded-lg">
            <RotateCcw />
            {t("restore")}
          </Button>
          <Button variant="destructive" onClick={() => setConfirm({ mediaIds: [...selected] })} className="h-11 rounded-lg">
            <Trash2 />
            {t("deleteForever")}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteForeverTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteForeverText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && destroy(confirm)} className="bg-destructive text-white hover:bg-destructive/90">
              {t("deleteForever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
