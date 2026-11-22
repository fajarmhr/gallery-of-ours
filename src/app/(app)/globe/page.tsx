import type { Metadata } from "next";
import { Earth } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MediaGallery } from "@/components/media/media-grid";
import { EmptyState, PageHeader, PageSection } from "@/components/empty-state";
import { GlobeView } from "@/components/places/globe";
import { mediaUrl } from "@/lib/format";
import { getPlaceMedia, getPlacesOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Globe" };

export default async function GlobePage({ searchParams }: PageProps<"/globe">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const t = await getTranslations("places");
  const tg = await getTranslations("globe");
  const places = await getPlacesOverview(user.id);

  // Nothing is selected until a place is tapped on the globe.
  const selected = places.find((p) => p.id === params.p);
  const items = selected ? await getPlaceMedia(user.id, selected.id) : [];

  return (
    <>
      <PageHeader title={tg("title")} subtitle={tg("subtitle")} />
      {places.length ? <GlobeView
        selectedId={selected?.id ?? null}
        focusSelected={Boolean(selected)}
        places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, count: p.count, coverUrl: mediaUrl(p.coverId, "thumb") }))}
      /> : <EmptyState icon={Earth} title={t("emptyTitle")} text={t("emptyText")} />}

      {selected ? (
        <PageSection title={selected.name} description={t("photosHere")} className="mt-10">
          <MediaGallery groups={[{ key: selected.id, items }]} />
        </PageSection>
      ) : (
        places.length > 0 && <p className="mt-6 rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">{t("pickPlace")}</p>
      )}
    </>
  );
}
