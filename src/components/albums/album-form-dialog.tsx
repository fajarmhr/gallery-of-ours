"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { createAlbum, updateAlbum, type AlbumInputValues } from "@/actions/albums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AlbumValues = {
  title: string;
  note: string;
  description: string;
  category: "trips" | "celebrations" | "everyday" | "other";
  startDate: string;
  endDate: string;
  unlockAt: string;
};

const empty: AlbumValues = { title: "", note: "", description: "", category: "everyday", startDate: "", endDate: "", unlockAt: "" };

export function AlbumFormDialog({
  albumId,
  initial,
  trigger,
  canSeal,
  capsule = false,
  open: controlledOpen,
  onOpenChange,
}: {
  albumId?: string;
  initial?: Partial<AlbumValues>;
  trigger?: React.ReactNode;
  canSeal: boolean;
  capsule?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("albums");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [values, setValues] = useState<AlbumValues>({ ...empty, ...initial });
  const [pending, setPending] = useState(false);

  const set = <K extends keyof AlbumValues>(key: K, value: AlbumValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const payload: AlbumInputValues = {
      title: values.title,
      note: values.note || null,
      description: values.description || null,
      category: values.category,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      unlockAt: canSeal ? values.unlockAt || null : undefined,
    };
    const result = albumId ? await updateAlbum(albumId, payload) : await createAlbum(payload);
    setPending(false);
    if (!result.ok) {
      toast.error(te.has(result.error) ? te(result.error) : te("unknown"));
      return;
    }
    toast.success(albumId ? t("updated") : t("created"));
    setOpen(false);
    if (!albumId && result.data && typeof result.data === "object" && "id" in result.data) {
      router.push(`/albums/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && !albumId) setValues({ ...empty, ...initial });
        setOpen(next);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">{albumId ? t("editTitle") : t("createTitle")}</DialogTitle>
            {capsule ? <DialogDescription>{t("capsuleHint")}</DialogDescription> : null}
          </DialogHeader>

          <FormField id="title" label={t("fieldTitle")}>
            <Input id="title" required maxLength={120} value={values.title} placeholder={t("fieldTitlePlaceholder")} onChange={(e) => set("title", e.target.value)} className="h-11 rounded-xl" />
          </FormField>
          <FormField id="note" label={t("fieldNote")}>
            <Input id="note" maxLength={80} value={values.note} placeholder={t("fieldNotePlaceholder")} onChange={(e) => set("note", e.target.value)} className="h-11 rounded-xl font-hand text-xl" />
          </FormField>
          <FormField id="description" label={t("fieldDescription")}>
            <Textarea id="description" maxLength={1000} rows={3} value={values.description} placeholder={t("fieldDescriptionPlaceholder")} onChange={(e) => set("description", e.target.value)} />
          </FormField>
          <FormField id="category" label={t("fieldCategory")}>
            <Select value={values.category} onValueChange={(v) => set("category", v as AlbumValues["category"])}>
              <SelectTrigger id="category" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["trips", "celebrations", "everyday", "other"] as const).map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="startDate" label={t("fieldStart")}>
              <Input id="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-11 rounded-xl" />
            </FormField>
            <FormField id="endDate" label={t("fieldEnd")}>
              <Input id="endDate" type="date" min={values.startDate || undefined} value={values.endDate} onChange={(e) => set("endDate", e.target.value)} className="h-11 rounded-xl" />
            </FormField>
          </div>
          {canSeal ? (
            <FormField id="unlockAt" label={t("fieldCapsule")} hint={capsule ? undefined : t("capsuleHint")}>
              <Input id="unlockAt" type="date" min={tomorrow} required={capsule} value={values.unlockAt} onChange={(e) => set("unlockAt", e.target.value)} className="h-11 rounded-xl" />
            </FormField>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10 rounded-xl">
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="h-10 rounded-xl px-5">
              {pending ? tc("saving") : albumId ? tc("save") : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
