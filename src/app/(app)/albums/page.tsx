import { Images, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlbumFormDialog } from "@/components/albums/album-form-dialog";
import { AlbumGrid } from "@/components/albums/album-grid";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { canCreateAlbum, isAdmin } from "@/lib/permissions";
import { getAlbumsOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Albums" };

const CATEGORIES = ["all", "trips", "celebrations", "everyday", "other"] as const;

export default async function AlbumsPage({ searchParams }: PageProps<"/albums">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const category = CATEGORIES.find((c) => c === params.c) ?? "all";
  const t = await getTranslations("albums");

  const albums = await getAlbumsOverview(user.id);
  const shown = category === "all" ? albums : albums.filter((a) => a.category === category);
  const totalItems = albums.reduce((sum, a) => sum + a.itemCount, 0);
  const canCreate = await canCreateAlbum(user);

  const newAlbum = canCreate ? (
    <AlbumFormDialog
      canSeal={isAdmin(user)}
      trigger={
        <Button className="h-10 rounded-xl px-4">
          <Plus />
          {t("newAlbum")}
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("summary", { albums: albums.length, items: totalItems })}>
        {newAlbum}
      </PageHeader>

      {albums.length === 0 ? (
        <EmptyState icon={Images} title={t("emptyTitle")} text={t("emptyText")}>
          {newAlbum}
        </EmptyState>
      ) : (
        <>
          <nav className="mb-3 flex flex-wrap gap-2" aria-label={t("fieldCategory")}>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={c === "all" ? "/albums" : `/albums?c=${c}`}
                aria-current={category === c ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  category === c ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                )}
              >
                {t(c)}
              </Link>
            ))}
          </nav>
          {shown.length === 0 ? <p className="py-10 text-center text-muted-foreground">{t("emptyFilter")}</p> : <AlbumGrid albums={shown} />}
        </>
      )}
    </>
  );
}
