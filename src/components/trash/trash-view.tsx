"use client";

import { Check, Play, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { deleteForever, restoreFromTrash } from "@/actions/trash";
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
    <div className="flex flex-col gap-8 pb-16">
      {albums.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">{t("albums")}</h2>
          <ul className="divide-y rounded-3xl border bg-card">
            {albums.map((album) => (
              <li key={album.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{album.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tc("items", { count: album.itemCount })} · {t("daysLeft", { count: daysLeft(album.deletedAt) })}
                  </p>
                </div>
                <Button variant="outline" onClick={() => restore({ albumIds: [album.id] })} className="h-9 rounded-lg">
                  <RotateCcw />
                  {t("restore")}
                </Button>
                <Button variant="destructive" onClick={() => setConfirm({ albumIds: [album.id] })} className="h-9 rounded-lg">
                  <Trash2 />
                  {t("deleteForever")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {media.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">{t("items")}</h2>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7">
            {media.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(item.id)}
                  className={cn("group relative aspect-square overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring", isSelected && "ring-3 ring-primary")}
                >
                  <ThumbhashImage src={mediaUrl(item.id, "thumb")} thumbhash={item.thumbhash} className="h-full w-full" imgClassName={cn(isSelected && "scale-95 opacity-80")} />
                  {item.type === "video" ? <Play className="absolute left-1.5 top-1.5 size-4 fill-white text-white drop-shadow" /> : null}
                  <span className={cn("absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border-2 border-white text-white", isSelected ? "bg-primary" : "bg-black/20")}>
                    {isSelected ? <Check className="size-3" /> : null}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-semibold text-white">
                    {t("daysLeft", { count: daysLeft(item.deletedAt) })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selected.size > 0 ? (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-xl lg:bottom-6">
          <span className="mr-auto text-sm font-semibold">{tc("selected", { count: selected.size })}</span>
          <Button variant="ghost" onClick={() => setSelected(new Set())} className="h-9 rounded-lg">
            {tc("clearSelection")}
          </Button>
          <Button variant="outline" onClick={() => restore({ mediaIds: [...selected] })} className="h-9 rounded-lg">
            <RotateCcw />
            {t("restore")}
          </Button>
          <Button variant="destructive" onClick={() => setConfirm({ mediaIds: [...selected] })} className="h-9 rounded-lg">
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
