import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/empty-state";
import { InviteButton, InvitesList } from "@/components/family/invites";
import { MembersList } from "@/components/family/members";
import { RequestsList } from "@/components/family/requests";
import { env } from "@/lib/env";
import { INVITE_DAYS, inviteUrl } from "@/lib/invites";
import { isSuperadmin } from "@/lib/permissions";
import { getInvites, getMembers, getPendingUsers, listAlbumsForMove } from "@/lib/queries";
import { requireAdminPage } from "@/lib/session";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage() {
  const user = await requireAdminPage();
  const t = await getTranslations("family");
  const ti = await getTranslations("invites");
  const [pending, members, albums, invites] = await Promise.all([getPendingUsers(), getMembers(), listAlbumsForMove(), getInvites()]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <InviteButton days={INVITE_DAYS} />
      </PageHeader>
      <div className="grid gap-5">
        <section className="rounded-3xl border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            {t("waiting")}
            {pending.length ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">{pending.length}</span>
            ) : null}
          </h2>
          <RequestsList requests={pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
        </section>

        <section className="rounded-3xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-bold">{ti("section")}</h2>
          <InvitesList invites={invites.map(({ token, ...invite }) => ({ ...invite, url: inviteUrl(env.appUrl, token) }))} />
        </section>

        <section className="rounded-3xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-bold">{t("members")}</h2>
          <MembersList members={members} albums={albums} currentUserId={user.id} canChangeRoles={isSuperadmin(user)} />
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {t("roleHint")}
          </p>
        </section>
      </div>
    </>
  );
}
