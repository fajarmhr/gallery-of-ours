import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MediaGallery } from "@/components/media/media-grid";
import { GlobeView } from "@/components/places/globe";
import { mediaUrl } from "@/lib/format";
import { getPlaceMedia, getPlacesOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Globe" };

export default async function GlobePage({ searchParams }: PageProps<"/globe">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const t = await getTranslations("places");
  const places = await getPlacesOverview(user.id);

  // Nothing is selected until a place is tapped on the globe.
  const selected = places.find((p) => p.id === params.p);
  const items = selected ? await getPlaceMedia(user.id, selected.id) : [];

  return (
    <>
      <GlobeView
        selectedId={selected?.id ?? null}
        focusSelected={Boolean(selected)}
        places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, count: p.count, coverUrl: mediaUrl(p.coverId, "thumb") }))}
      />

      {selected ? (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <h2 className="font-display text-2xl font-bold tracking-tight">{selected.name}</h2>
            <span className="text-sm text-muted-foreground">{t("photosHere")}</span>
          </div>
          <MediaGallery groups={[{ key: selected.id, items }]} />
        </section>
      ) : (
        places.length > 0 && <p className="mt-10 text-center text-sm text-muted-foreground">{t("pickPlace")}</p>
      )}
    </>
  );
}
