"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo, useRef, useState } from "react";
import MapGL, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import Supercluster from "supercluster";
import { mediaUrl } from "@/lib/format";
import type { MapPoint } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/** Copied into public/ by scripts/copy-maplibre-worker.mjs — Turbopack's bundled copy can't resolve its shared chunk. */
export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** A place as the globe shows it: one dot per place. */
export type MapPlace = { id: string; name: string; lat: number; lng: number; count: number; coverUrl: string };

/** Past this zoom, dots that still overlap sit on the same spot, so tapping them opens their place instead of zooming. */
const MAX_CLUSTER_ZOOM = 17;

type DotProps = { cover: string; placeId: string; selected: boolean };
type Bounds = [number, number, number, number];
type ViewSource = { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number }; getZoom: () => number };

/** Every photo as a dot at its exact spot; nearby dots stack into a numbered pile until you zoom in. */
export function PlacesMap({ points, selectedId }: { points: MapPoint[]; selectedId: string | null }) {
  const t = useTranslations("location");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const [view, setView] = useState<{ bounds: Bounds; zoom: number } | null>(null);

  const index = useMemo(() => {
    const clusters = new Supercluster<DotProps, DotProps>({
      radius: 60,
      maxZoom: MAX_CLUSTER_ZOOM,
      map: (props) => ({ ...props }),
      reduce: (total, props) => {
        total.selected = total.selected || props.selected;
      },
    });
    clusters.load(
      points.map((point) => ({
        type: "Feature" as const,
        properties: { cover: point.id, placeId: point.placeId, selected: point.placeId === selectedId },
        geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
      })),
    );
    return clusters;
  }, [points, selectedId]);

  const [initialViewState] = useState(() => {
    if (points.length > 1) {
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      return {
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ] as [[number, number], [number, number]],
        fitBoundsOptions: { padding: 70, maxZoom: 11 },
      };
    }
    return { longitude: points[0]?.lng ?? 113.9, latitude: points[0]?.lat ?? -2.5, zoom: points.length ? 10 : 3.5 };
  });

  function syncView(map: ViewSource) {
    const bounds = map.getBounds();
    setView({ bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], zoom: map.getZoom() });
  }

  const dots = view ? index.getClusters(view.bounds, Math.floor(view.zoom)) : [];

  return (
    <div className="h-[380px] overflow-hidden rounded-3xl border bg-muted sm:h-[460px] lg:h-[540px]">
      <MapGL
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light}
        workerUrl={MAPLIBRE_WORKER_URL}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        onLoad={(event) => syncView(event.target)}
        onMoveEnd={(event) => syncView(event.target)}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {dots.map((dot) => {
          const [lng, lat] = dot.geometry.coordinates as [number, number];
          const props = dot.properties;
          const clusterId = "cluster_id" in props ? props.cluster_id : null;
          const count = "point_count" in props ? props.point_count : 1;
          return (
            <Marker
              key={clusterId !== null ? `stack-${clusterId}` : `photo-${props.cover}`}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                const zoom = clusterId !== null ? index.getClusterExpansionZoom(clusterId) : Number.POSITIVE_INFINITY;
                if (zoom <= MAX_CLUSTER_ZOOM) mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 });
                else router.push(`/places?p=${props.placeId}`, { scroll: false });
              }}
            >
              <button type="button" aria-label={count > 1 ? t("mapStack", { count }) : t("mapPhoto")} className="group relative block cursor-pointer">
                <span
                  className={cn(
                    "polaroid block -rotate-[4deg] p-1 pb-3 transition-transform duration-300 group-hover:scale-110",
                    count > 1 ? "size-12 sm:size-14" : "size-10 sm:size-11",
                    props.selected && "scale-115 ring-3 ring-primary",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(props.cover, "thumb")} alt="" className="size-full object-cover" />
                </span>
                {count > 1 ? (
                  <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-none text-primary-foreground tabular-nums">
                    {count}
                  </span>
                ) : null}
              </button>
            </Marker>
          );
        })}
      </MapGL>
    </div>
  );
}
