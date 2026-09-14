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
        <Button className="h-10 rounded-xl px-4">
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
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-4">
          {capsules.map((capsule) => {
            const opens = new Date(capsule.unlockAt!);
            const sealed = opens.getTime() > now;
            const days = Math.max(1, Math.ceil((opens.getTime() - now) / 86_400_000));
            return (
              <Link key={capsule.id} href={`/albums/${capsule.id}`} className="group flex flex-col gap-1 rounded-3xl px-2.5 pb-4 pt-7 transition-colors hover:bg-foreground/5 sm:px-4">
                <AlbumPile covers={capsule.covers.map((c) => mediaUrl(c.id, "thumb"))} locked={capsule.locked} sealed={sealed} className="mx-auto mb-6 w-[70%] sm:w-[62%]" />
                <span className={cn("self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold", sealed ? "bg-accent text-accent-foreground" : "bg-olive-soft text-olive")}>
                  {sealed ? t("sealed") : t("open")}
                </span>
                <span className="font-display text-base font-bold leading-snug tracking-tight sm:text-lg">{capsule.title}</span>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  {sealed
                    ? `${t("opensIn", { count: days })} · ${t("opensOn", { date: format.dateTime(opens, { dateStyle: "medium" }) })}`
                    : t("opened", { date: format.dateTime(opens, { dateStyle: "medium" }) })}
                </span>
                {capsule.createdByName ? <span className="text-xs text-muted-foreground">{t("sealedBy", { name: capsule.createdByName })}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
