import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { getFavorites } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const user = await requireActiveUser();
  const t = await getTranslations("favorites");
  const items = await getFavorites(user.id);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <MediaGallery groups={[{ key: "favorites", items }]} />
      )}
    </>
  );
}
