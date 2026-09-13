"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapIcon, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import MapGL, { Marker, type MapRef } from "react-map-gl/maplibre";
import { Button } from "@/components/ui/button";
import { MAP_STYLES, type MapPlace } from "./places-map";

export function GlobeView({ places }: { places: MapPlace[] }) {
  const t = useTranslations("globe");
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !spinning || !map) return;
    let frame = 0;
    const step = () => {
      const center = map.getCenter();
      map.setCenter([center.lng + 0.06, center.lat]);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [loaded, spinning]);

  const avgLat = places.length ? places.reduce((s, p) => s + p.lat, 0) / places.length : -2.5;
  const avgLng = places.length ? places.reduce((s, p) => s + p.lng, 0) / places.length : 113.9;

  return (
    <div className="relative h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden rounded-3xl border bg-[#0f0b09] lg:h-[calc(100dvh-9rem)]">
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: avgLng, latitude: avgLat, zoom: 1.7 }}
        mapStyle={resolvedTheme === "light" ? MAP_STYLES.light : MAP_STYLES.dark}
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
              router.push(`/places?p=${place.id}`);
            }}
          >
            <button type="button" aria-label={place.name} title={`${place.name} · ${place.count}`} className="relative grid cursor-pointer place-items-center">
              <span className="absolute size-7 animate-ping rounded-full bg-primary/40" />
              <span className="relative size-3.5 rounded-full border-2 border-white bg-primary shadow" />
            </button>
          </Marker>
        ))}
      </MapGL>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div className="text-white drop-shadow">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="text-sm text-white/85">{t("subtitle")}</p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Button variant="ghost" onClick={() => setSpinning((s) => !s)} className="glass h-10 rounded-xl px-4 text-white hover:bg-white/25 hover:text-white">
            {spinning ? <Pause /> : <Play />}
            {spinning ? t("stop") : t("spin")}
          </Button>
          <Button asChild variant="ghost" className="glass h-10 rounded-xl px-4 text-white hover:bg-white/25 hover:text-white">
            <Link href="/places">
              <MapIcon />
              {t("flatMap")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
