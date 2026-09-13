import { Search, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlbumGrid } from "@/components/albums/album-grid";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { searchMemories } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const t = await getTranslations("search");
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const results = query ? await searchMemories(user.id, query) : null;
  const total = results ? results.albums.length + results.media.length : 0;

  return (
    <>
      <PageHeader title={t("title")} subtitle={results ? t("results", { count: total, query }) : t("hint")} />
      <form action="/search" className="mb-8 flex h-12 items-center gap-2 rounded-2xl border bg-card px-4 focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-5 shrink-0 text-muted-foreground" />
        <input
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          autoFocus={!query}
          className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </form>

      {results && total === 0 ? <EmptyState icon={SearchX} title={t("emptyTitle")} text={t("emptyText")} /> : null}

      {results && results.albums.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 font-display text-xl font-bold">{t("albums")}</h2>
          <AlbumGrid albums={results.albums} />
        </section>
      ) : null}

      {results && results.media.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">{t("photos")}</h2>
          <MediaGallery groups={[{ key: `search-${query}`, items: results.media }]} />
        </section>
      ) : null}
    </>
  );
}
