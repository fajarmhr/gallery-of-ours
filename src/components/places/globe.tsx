"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapIcon, Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import MapGL, { Marker, type MapRef } from "react-map-gl/maplibre";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAP_STYLES, MAPLIBRE_WORKER_URL, type MapPlace } from "./places-map";

const FOCUS_ZOOM = 2.5;

export function GlobeView({
  places,
  selectedId,
  focusSelected,
}: {
  places: MapPlace[];
  selectedId: string | null;
  /** Open centred on the selected place (it came from the link) instead of spinning. */
  focusSelected: boolean;
}) {
  const t = useTranslations("globe");
  const tc = useTranslations("common");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const frameRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !spinning || !map) return;
    const step = () => {
      const center = map.getCenter();
      map.setCenter([center.lng + 0.06, center.lat]);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [loaded, spinning]);

  const selected = places.find((p) => p.id === selectedId);
  const avgLat = places.length ? places.reduce((s, p) => s + p.lat, 0) / places.length : -2.5;
  const avgLng = places.length ? places.reduce((s, p) => s + p.lng, 0) / places.length : 113.9;
  const initialViewState =
    focusSelected && selected
      ? { longitude: selected.lng, latitude: selected.lat, zoom: FOCUS_ZOOM }
      : { longitude: avgLng, latitude: avgLat, zoom: 1.7 };

  function focusPlace(place: MapPlace) {
    // Cancel the pending spin frame now — its setCenter would interrupt the flight.
    cancelAnimationFrame(frameRef.current);
    setSpinning(false);
    const map = mapRef.current;
    map?.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), FOCUS_ZOOM), duration: reducedMotion ? 0 : 1200 });
    router.replace(`/globe?p=${place.id}`, { scroll: false });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5">
        <p className="min-w-0 text-sm text-muted-foreground">{selected?.name ?? tc("items", { count: places.reduce((sum, place) => sum + place.count, 0) })}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" aria-pressed={spinning} onClick={() => setSpinning((s) => !s)} className="h-11 rounded-lg px-4">
            {spinning ? <Pause /> : <Play />}
            {spinning ? t("stop") : t("spin")}
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-lg px-4">
            <Link href={selectedId ? `/places?p=${selectedId}` : "/places"}>
              <MapIcon />
              {t("flatMap")}
            </Link>
          </Button>
        </div>
      </div>
      <div className="relative h-[min(60dvh,36rem)] min-h-72 bg-muted">
      <MapGL
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={resolvedTheme === "light" ? MAP_STYLES.light : MAP_STYLES.dark}
        workerUrl={MAPLIBRE_WORKER_URL}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        onLoad={(event) => {
          event.target.setProjection({ type: "globe" });
          setLoaded(true);
        }}
        onMoveStart={(event) => {
          if ((event as { originalEvent?: unknown }).originalEvent) setSpinning(false);
        }}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            longitude={place.lng}
            latitude={place.lat}
            anchor="center"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              focusPlace(place);
            }}
          >
            <button
              type="button"
              aria-label={place.name}
              aria-pressed={place.id === selectedId}
              title={`${place.name} · ${place.count}`}
              className="relative grid size-11 cursor-pointer place-items-center rounded-full"
            >
              <span
                className={cn(
                  "relative size-3.5 rounded-full border-2 border-white bg-primary transition-colors duration-200",
                  place.id === selectedId && "ring-4 ring-primary/25",
                )}
              />
            </button>
          </Marker>
        ))}
      </MapGL>
      </div>
    </div>
  );
}
