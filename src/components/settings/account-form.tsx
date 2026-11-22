"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/settings";
import { authErrorMessage } from "@/components/auth/sign-in-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Props = { user: { name: string; username: string | null; email: string; emailVerified: boolean; roleLabel: string } };

export function AccountForm({ user }: Props) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await updateProfile({ name });
    setSaving(false);
    if (!result.ok) return toast.error(te.has(result.error) ? te(result.error) : te("unknown"));
    toast.success(t("saved"));
    router.refresh();
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setChanging(true);
    const result = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setChanging(false);
    if (result.error) return toast.error(authErrorMessage(ta, result.error.code));
    setCurrent("");
    setNext("");
    toast.success(t("passwordChanged"));
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={saveName} className="flex max-w-2xl flex-col gap-3">
        <Label htmlFor="display-name">{t("displayName")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="display-name" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-lg" />
          <Button type="submit" disabled={saving || !name.trim() || name.trim() === user.name} className="h-12 rounded-lg px-5">
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </form>

      <dl className="grid gap-5 border-t pt-6">
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm leading-6 text-muted-foreground">{t("username")}</dt>
          <dd className="min-w-0 text-base [overflow-wrap:anywhere]">{user.username ? `@${user.username}` : "—"}</dd>
        </div>
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm leading-6 text-muted-foreground">{t("email")}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-base">
            <span className="min-w-0 [overflow-wrap:anywhere]">{user.email}</span>
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-olive">
                <BadgeCheck className="size-3.5" />
                {t("verified")}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="grid min-w-0 gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm leading-6 text-muted-foreground">{t("role")}</dt>
          <dd className="min-w-0 text-base [overflow-wrap:anywhere]">{user.roleLabel}</dd>
        </div>
      </dl>

      <form onSubmit={changePassword} className="flex flex-col gap-5 border-t pt-6">
        <h3 className="font-display text-2xl font-medium tracking-tight">{t("changePassword")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="h-12 rounded-lg" />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="h-12 rounded-lg" />
          </div>
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={changing} className="h-11 rounded-lg px-4">
            {changing ? tc("saving") : t("changePassword")}
          </Button>
        </div>
      </form>
    </div>
  );
}
