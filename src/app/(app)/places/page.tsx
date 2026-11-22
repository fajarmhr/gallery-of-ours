import { Earth, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, PageSection } from "@/components/empty-state";
import { MediaGallery } from "@/components/media/media-grid";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { PlacesMap } from "@/components/places/places-map";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/format";
import { getMapPoints, getPlaceMedia, getPlacesOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({ searchParams }: PageProps<"/places">) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const t = await getTranslations("places");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const [places, points] = await Promise.all([getPlacesOverview(user.id), getMapPoints(user.id)]);

  if (places.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={MapPin} title={t("emptyTitle")} text={t("emptyText")} />
      </>
    );
  }

  // Nothing is selected until a place is picked on the map or in the list.
  const selected = places.find((p) => p.id === params.p);
  const items = selected ? await getPlaceMedia(user.id, selected.id) : [];
  const totalPhotos = places.reduce((sum, p) => sum + p.count, 0);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { places: places.length, photos: totalPhotos })}>
        <Button asChild variant="outline" className="h-11 rounded-lg px-4">
          <Link href="/globe">
            <Earth />
            {t("openGlobe")}
          </Link>
        </Button>
      </PageHeader>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <PlacesMap selectedId={selected?.id ?? null} points={points} />
        <ul aria-label={t("title")} className="flex max-h-80 min-w-0 flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border bg-card p-2 lg:max-h-[500px]">
          {places.map((place) => (
            <li key={place.id}>
              <Link
                href={`/places?p=${place.id}`}
                scroll={false}
                aria-current={place.id === selected?.id ? "true" : undefined}
                className={cn(
                  "flex min-h-20 items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:bg-muted",
                  place.id === selected?.id && "border-primary/20 bg-accent/60",
                )}
              >
                <ThumbhashImage src={mediaUrl(place.coverId, "thumb")} className="size-12 shrink-0 rounded-lg" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium leading-relaxed">{place.name}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {[tc("photos", { count: place.count }), place.city, place.country].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {[
                      t("firstVisit", { date: format.dateTime(new Date(place.firstAt * 1000), { month: "short", year: "numeric" }) }),
                      place.albumCount > 1 ? t("visits", { count: place.albumCount }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <PageSection title={selected.name} description={t("photosHere")} className="mt-10">
          <MediaGallery groups={[{ key: selected.id, items }]} />
        </PageSection>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">{t("pickPlace")}</p>
      )}
    </>
  );
}
