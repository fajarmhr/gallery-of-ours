"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { createMilestone, deleteMilestone, updateMilestone } from "@/actions/milestones";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Kind = "birthday" | "anniversary" | "other";
type Values = { title: string; date: string; kind: Kind; repeatsYearly: boolean };

export function MilestoneDialog({ milestone, trigger }: { milestone?: Values & { id: string }; trigger: React.ReactNode }) {
  const t = useTranslations("milestones");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const blank: Values = { title: "", date: "", kind: "birthday", repeatsYearly: true };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(milestone ?? blank);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = milestone ? await updateMilestone(milestone.id, values) : await createMilestone(values);
    setPending(false);
    if (!result.ok) return toast.error(te.has(result.error) ? te(result.error) : te("unknown"));
    toast.success(t("saved"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValues(milestone ?? blank);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">{milestone ? t("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-title">{t("name")}</Label>
            <Input id="m-title" required maxLength={100} placeholder={t("namePlaceholder")} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-date">{t("date")}</Label>
              <Input id="m-date" type="date" required value={values.date} onChange={(e) => setValues({ ...values, date: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-kind">{t("kind")}</Label>
              <Select value={values.kind} onValueChange={(kind) => setValues({ ...values, kind: kind as Kind })}>
                <SelectTrigger id="m-kind" className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["birthday", "anniversary", "other"] as const).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5">
            <span className="text-sm font-medium">{t("repeats")}</span>
            <Switch checked={values.repeatsYearly} onCheckedChange={(repeatsYearly) => setValues({ ...values, repeatsYearly })} />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10 rounded-xl">
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="h-10 rounded-xl px-5">
              {pending ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MilestoneDeleteButton({ id }: { id: string }) {
  const t = useTranslations("milestones");
  const tc = useTranslations("common");
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" aria-label={tc("delete")} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              const result = await deleteMilestone(id);
              if (result.ok) {
                toast.success(t("deleted"));
                router.refresh();
              }
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {tc("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
