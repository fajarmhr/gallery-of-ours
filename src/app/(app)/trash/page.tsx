import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { purgeExpiredTrash } from "@/actions/trash";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { TrashView } from "@/components/trash/trash-view";
import { TRASH_DAYS } from "@/lib/format";
import { getTrash } from "@/lib/queries";
import { requireAdminPage } from "@/lib/session";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  await requireAdminPage();
  after(() => purgeExpiredTrash().catch((error) => console.error("Trash purge failed", error)));
  const t = await getTranslations("trash");
  const trash = await getTrash();
  const empty = trash.albums.length === 0 && trash.media.length === 0;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { days: TRASH_DAYS })} />
      {empty ? <EmptyState icon={Trash2} title={t("emptyTitle")} text={t("emptyText")} /> : <TrashView albums={trash.albums} media={trash.media} />}
    </>
  );
}
