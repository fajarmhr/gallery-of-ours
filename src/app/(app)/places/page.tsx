import { Earth, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { PlacesMap } from "@/components/places/places-map";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/format";
import { getPlaceMedia, getPlacesOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({ searchParams }: PageProps<"/places">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const t = await getTranslations("places");
  const tc = await getTranslations("common");
  const places = await getPlacesOverview(user.id);

  if (places.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={MapPin} title={t("emptyTitle")} text={t("emptyText")} />
      </>
    );
  }

  const selected = places.find((p) => p.id === params.p) ?? places[0]!;
  const items = await getPlaceMedia(user.id, selected.id);
  const totalPhotos = places.reduce((sum, p) => sum + p.count, 0);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { places: places.length, photos: totalPhotos })}>
        <Button asChild variant="outline" className="h-10 rounded-xl px-4">
          <Link href="/globe">
            <Earth />
            {t("openGlobe")}
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PlacesMap
          selectedId={selected.id}
          places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, count: p.count, coverUrl: mediaUrl(p.coverId, "thumb") }))}
        />
        <ul className="flex max-h-[540px] flex-col gap-1 overflow-y-auto">
          {places.map((place) => (
            <li key={place.id}>
              <Link
                href={`/places?p=${place.id}`}
                scroll={false}
                aria-current={place.id === selected.id ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-colors hover:bg-foreground/5",
                  place.id === selected.id && "border-border bg-card shadow-sm",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(place.coverId, "thumb")} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold">{place.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[tc("photos", { count: place.count }), place.city, place.country].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-display text-2xl font-bold tracking-tight">{selected.name}</h2>
          <span className="text-sm text-muted-foreground">{t("photosHere")}</span>
        </div>
        <MediaGallery groups={[{ key: selected.id, items }]} />
      </section>
    </>
  );
}
