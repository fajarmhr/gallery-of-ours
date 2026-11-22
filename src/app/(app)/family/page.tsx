import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader, PageSection } from "@/components/empty-state";
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
    <div className="max-w-5xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <InviteButton days={INVITE_DAYS} />
      </PageHeader>
      <div className="grid gap-6">
        <PageSection
          title={t("waiting")}
          className="paper-panel"
          action={
            pending.length ? (
              <span className="rounded-md bg-accent px-2 py-1 font-sans text-sm font-medium tabular-nums text-accent-foreground">{pending.length}</span>
            ) : null
          }
        >
          <RequestsList requests={pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
        </PageSection>

        <PageSection title={ti("section")} className="paper-panel">
          <InvitesList invites={invites.map(({ token, ...invite }) => ({ ...invite, url: inviteUrl(env.appUrl, token) }))} />
        </PageSection>

        <PageSection title={t("members")} className="paper-panel">
          <MembersList members={members} albums={albums} currentUserId={user.id} canChangeRoles={isSuperadmin(user)} />
          <p className="mt-6 flex items-start gap-2 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
            <Lock className="mt-1 size-4 shrink-0" />
            {t("roleHint")}
          </p>
        </PageSection>
      </div>
    </div>
  );
}
