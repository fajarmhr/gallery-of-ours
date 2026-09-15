"use client";

import { UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { grantEditing, removeUser, revokeEditing, setUserRole } from "@/actions/family";
import { UserAvatar } from "@/components/brand";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  image: string | null;
  grant: { albumId: string | null; albumTitle: string | null; expiresAt: string | null } | null;
};

const ROLE_STYLE: Record<string, string> = {
  superadmin: "bg-foreground text-background",
  admin: "bg-accent text-accent-foreground",
  member: "bg-olive-soft text-olive",
};

export function MembersList({
  members,
  albums,
  currentUserId,
  canChangeRoles,
}: {
  members: Member[];
  albums: { id: string; title: string }[];
  currentUserId: string;
  /** Superadmins: they change roles and can remove members and admins. */
  canChangeRoles: boolean;
}) {
  const t = useTranslations("family");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const [granting, setGranting] = useState<string | null>(null);
  const [scope, setScope] = useState("all");
  const [days, setDays] = useState<number | null>(7);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [now] = useState(() => Date.now());

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  async function changeRole(member: Member, role: Role) {
    const result = await setUserRole(member.id, role);
    if (!result.ok) return fail(result.error);
    toast.success(t("roleChanged", { name: member.name, role: tr(role) }));
    router.refresh();
  }

  async function give(member: Member) {
    const result = await grantEditing(member.id, { albumId: scope === "all" ? null : scope, days });
    if (!result.ok) return fail(result.error);
    toast.success(t("given", { name: member.name }));
    setGranting(null);
    router.refresh();
  }

  async function revoke(member: Member) {
    const result = await revokeEditing(member.id);
    if (!result.ok) return fail(result.error);
    toast.success(t("removed", { name: member.name }));
    router.refresh();
  }

  async function remove(member: Member) {
    setRemoving(null);
    const result = await removeUser(member.id);
    if (!result.ok) return fail(result.error);
    toast.success(t("memberRemoved", { name: member.name }));
    router.refresh();
  }

  const scopeLabel = (member: Member) => {
    if (member.role !== "member") return t("fullAccess");
    if (!member.grant) return t("viewOnly");
    const where = member.grant.albumId ? (member.grant.albumTitle ?? "") : t("allAlbums");
    const until = member.grant.expiresAt
      ? t("daysLeft", { count: Math.max(1, Math.ceil((new Date(member.grant.expiresAt).getTime() - now) / 86_400_000)) })
      : t("untilOff");
    return `${where} · ${until}`;
  };

  return (
    <>
      <ul className="divide-y">
        {members.map((member) => {
          const isMember = member.role === "member";
          const open = granting === member.id;
          const removable = canChangeRoles && member.id !== currentUserId && member.role !== "superadmin";
          return (
            <li key={member.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <UserAvatar name={member.name} image={member.image} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-semibold">
                    {member.name} {member.id === currentUserId ? <span className="font-normal text-muted-foreground">{t("you")}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.username ? `@${member.username}` : member.email}</p>
                </div>

                {canChangeRoles ? (
                  <Select value={member.role} onValueChange={(value) => changeRole(member, value as Role)}>
                    <SelectTrigger className="h-9 w-[140px] rounded-full" aria-label={tr(member.role as Role)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["superadmin", "admin", "member"] as const).map((role) => (
                        <SelectItem key={role} value={role}>
                          {tr(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", ROLE_STYLE[member.role])}>{tr(member.role as Role)}</span>
                )}

                {removable ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemoving(member)}
                    aria-label={t("removeLabel", { name: member.name })}
                    title={t("removeLabel", { name: member.name })}
                    className="size-9 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus />
                  </Button>
                ) : null}

                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:min-w-[240px] sm:justify-end">
                  <span className="text-right text-xs text-muted-foreground">{scopeLabel(member)}</span>
                  {isMember ? (
                    <Switch
                      checked={Boolean(member.grant) || open}
                      aria-label={t("toggleEditing", { name: member.name })}
                      onCheckedChange={(checked) => {
                        if (!checked && member.grant) void revoke(member);
                        else if (!checked) setGranting(null);
                        else {
                          setScope("all");
                          setDays(7);
                          setGranting(member.id);
                        }
                      }}
                      className="data-[state=checked]:bg-olive"
                    />
                  ) : null}
                </div>
              </div>

              {open ? (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border bg-background p-3">
                  <p className="text-sm font-semibold">{t("editingAccess", { name: member.name })}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-20 text-xs font-bold text-muted-foreground">{t("scope")}</span>
                    <Select value={scope} onValueChange={setScope}>
                      <SelectTrigger className="h-9 min-w-[200px] rounded-xl">
                        <SelectValue placeholder={t("chooseAlbum")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allAlbums")}</SelectItem>
                        {albums.map((album) => (
                          <SelectItem key={album.id} value={album.id}>
                            {album.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-20 text-xs font-bold text-muted-foreground">{t("duration")}</span>
                    {[
                      { value: 1, label: t("oneDay") },
                      { value: 7, label: t("sevenDays") },
                      { value: 30, label: t("thirtyDays") },
                      { value: null, label: t("untilTurnOff") },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        type="button"
                        aria-pressed={days === option.value}
                        onClick={() => setDays(option.value)}
                        className={cn(
                          "h-8 rounded-full border px-3 text-xs font-semibold",
                          days === option.value ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setGranting(null)} className="h-9 rounded-lg">
                      {tc("cancel")}
                    </Button>
                    <Button onClick={() => give(member)} className="h-9 rounded-lg bg-olive text-olive-foreground hover:bg-olive/90">
                      {t("give")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={removing !== null} onOpenChange={(value) => !value && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing ? t("removeTitle", { name: removing.name }) : null}</AlertDialogTitle>
            <AlertDialogDescription>{removing ? t("removeText", { name: removing.name }) : null}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove(removing)} className="bg-destructive text-white hover:bg-destructive/90">
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
