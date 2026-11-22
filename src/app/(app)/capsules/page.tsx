import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AlbumFormDialog } from "@/components/albums/album-form-dialog";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { AlbumPile } from "@/components/polaroid";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { getAlbumsOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Time capsules" };

export default async function CapsulesPage() {
  const user = await requireActiveUser();
  const admin = isAdmin(user);
  const t = await getTranslations("capsules");
  const format = await getFormatter();
  const capsules = await getAlbumsOverview(user.id, { capsulesOnly: true });
  const now = new Date().getTime();

  const create = admin ? (
    <AlbumFormDialog
      capsule
      canSeal
      trigger={
        <Button className="h-11 rounded-lg px-4">
          <Hourglass />
          {t("new")}
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {create}
      </PageHeader>
      {capsules.length === 0 ? (
        <EmptyState icon={Hourglass} title={t("emptyTitle")} text={t("emptyText")}>
          {create}
        </EmptyState>
      ) : (
        <div className="grid gap-5 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4">
          {capsules.map((capsule) => {
            const opens = new Date(capsule.unlockAt!);
            const sealed = opens.getTime() > now;
            const days = Math.max(1, Math.ceil((opens.getTime() - now) / 86_400_000));
            return (
              <Link key={capsule.id} href={`/albums/${capsule.id}`} className="group flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 pt-7 transition-colors hover:border-primary/35 sm:p-5 sm:pt-8">
                <AlbumPile covers={capsule.covers.map((c) => mediaUrl(c.id, "thumb"))} locked={capsule.locked} sealed={sealed} className="mx-auto mb-5 w-[82%]" />
                <span className={cn("self-start rounded-md px-2 py-1 text-xs font-medium", sealed ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                  {sealed ? t("sealed") : t("open")}
                </span>
                <span className="break-words font-display text-xl font-medium leading-tight tracking-tight sm:text-2xl">{capsule.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {sealed
                    ? `${t("opensIn", { count: days })} · ${t("opensOn", { date: format.dateTime(opens, { dateStyle: "medium" }) })}`
                    : t("opened", { date: format.dateTime(opens, { dateStyle: "medium" }) })}
                </span>
                {capsule.createdByName ? <span className="text-sm text-muted-foreground">{t("sealedBy", { name: capsule.createdByName })}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
