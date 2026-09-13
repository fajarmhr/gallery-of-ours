"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import MapGL, { Marker, NavigationControl } from "react-map-gl/maplibre";
import { cn } from "@/lib/utils";

export const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export type MapPlace = { id: string; name: string; lat: number; lng: number; count: number; coverUrl: string };

export function PlacesMap({ places, selectedId }: { places: MapPlace[]; selectedId: string | null }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const initialViewState =
    places.length > 1
      ? {
          bounds: [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 70, maxZoom: 11 },
        }
      : { longitude: places[0]?.lng ?? 113.9, latitude: places[0]?.lat ?? -2.5, zoom: places.length ? 10 : 3.5 };

  return (
    <div className="h-[380px] overflow-hidden rounded-3xl border bg-muted sm:h-[460px] lg:h-[540px]">
      <MapGL
        initialViewState={initialViewState}
        mapStyle={resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {places.map((place) => (
          <Marker
            key={place.id}
            longitude={place.lng}
            latitude={place.lat}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              router.push(`/places?p=${place.id}`, { scroll: false });
            }}
          >
            <button type="button" aria-label={`${place.name} (${place.count})`} className="group relative block cursor-pointer">
              <span
                className={cn(
                  "polaroid block size-12 -rotate-[4deg] p-1 pb-3 transition-transform duration-300 group-hover:scale-110 sm:size-14",
                  place.id === selectedId && "scale-115 ring-3 ring-primary",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={place.coverUrl} alt="" className="size-full object-cover" />
              </span>
              <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-none text-primary-foreground tabular-nums">
                {place.count}
              </span>
            </button>
          </Marker>
        ))}
      </MapGL>
    </div>
  );
}
