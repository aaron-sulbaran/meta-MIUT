"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import type { Map as MapLibreMap, GeoJSONSource, Marker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { MuseMark } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { walkMinutes } from "@/lib/geo";

// Full-screen heatmap for the Events tab. Hotspots are where Muse's picks for
// this student are (see lib/map/heat.ts). The map opens on the student's live
// location and falls back to their saved campus spot when location is off.
// A swipeable strip of event cards sits at the bottom: swiping flies the map
// to that event, tapping a hotspot scrolls the strip to its card.
// Tiles: OpenFreeMap (OpenStreetMap data, no key), drawn with MapLibre GL.

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// About a one-mile view around the student, the walking range for free food.
const USER_ZOOM = 14.4;

type Point = { lat: number; lng: number };

export type MapCard = {
  eventId: string;
  title: string;
  place: Point & { name: string };
  dateLine: string;
  free: boolean;
  weight: number;
  pickRank: number | null;
  reason: string | null;
};

type LocationState = { point: Point; live: boolean };

function scrollStripTo(strip: HTMLElement | null, eventId: string) {
  const card = strip?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
  if (!strip || !card) return;
  strip.scrollTo({ left: card.offsetLeft - 12, behavior: "smooth" });
}

function toFeatureCollection(cards: MapCard[]) {
  return {
    type: "FeatureCollection" as const,
    features: cards.map((card) => ({
      type: "Feature" as const,
      properties: { eventId: card.eventId, weight: card.weight, pick: card.pickRank ?? 0 },
      geometry: { type: "Point" as const, coordinates: [card.place.lng, card.place.lat] },
    })),
  };
}

export function EventsHeatmap({
  cards,
  fallbackLocation,
  museLive,
}: {
  cards: MapCard[];
  fallbackLocation: Point;
  museLive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const locationRef = useRef<LocationState>({ point: fallbackLocation, live: false });
  const [location, setLocation] = useState<LocationState>({ point: fallbackLocation, live: false });
  const [activeId, setActiveId] = useState<string | null>(cards[0]?.eventId ?? null);
  const [mapFailed, setMapFailed] = useState(false);

  // Build the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    void import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (cancelled) return;
        map = new maplibregl.Map({
          container,
          style: STYLE_URL,
          center: [fallbackLocation.lng, fallbackLocation.lat],
          zoom: USER_ZOOM,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        // Lift the map credit above the card strip and tab bar so it stays visible.
        const corner = container.querySelector<HTMLElement>(".maplibregl-ctrl-bottom-right");
        if (corner) corner.style.bottom = "calc(var(--tabbar-height) + var(--tabbar-gap) + 222px)";
        mapRef.current = map;

        const dot = document.createElement("div");
        Object.assign(dot.style, {
          width: "18px",
          height: "18px",
          borderRadius: "9999px",
          background: "#0866ff",
          border: "3px solid #ffffff",
          boxShadow: "0 0 0 8px rgba(8,102,255,0.18), 0 1px 4px rgba(0,0,0,0.3)",
        });
        dot.setAttribute("aria-label", "You are here");
        userMarkerRef.current = new maplibregl.Marker({ element: dot })
          .setLngLat([locationRef.current.point.lng, locationRef.current.point.lat])
          .addTo(map);

        map.on("error", (event) => {
          if (String(event.error?.message ?? "").includes("style")) setMapFailed(true);
        });

        map.on("load", () => {
          if (!map) return;
          container.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
          map.addSource("events", { type: "geojson", data: toFeatureCollection(cards) });
          map.addLayer({
            id: "events-heat",
            type: "heatmap",
            source: "events",
            paint: {
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 1.6, 15, 2.4, 17, 3],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 26, 14.5, 58, 17, 110],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.85, 18, 0.7],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(8,102,255,0)",
                0.15,
                "rgba(8,102,255,0.35)",
                0.4,
                "rgba(122,92,255,0.6)",
                0.65,
                "rgba(214,72,214,0.75)",
                0.85,
                "rgba(255,92,120,0.85)",
                1,
                "rgba(255,170,60,0.92)",
              ],
            },
          });
          map.addLayer({
            id: "events-dots",
            type: "circle",
            source: "events",
            paint: {
              "circle-radius": ["case", [">", ["get", "pick"], 0], 7, 4.5],
              "circle-color": ["case", [">", ["get", "pick"], 0], "#0866ff", "#ffffff"],
              "circle-stroke-color": ["case", [">", ["get", "pick"], 0], "#ffffff", "#0866ff"],
              "circle-stroke-width": 2,
            },
          });
          map.addLayer({
            id: "events-pick-labels",
            type: "symbol",
            source: "events",
            filter: [">", ["get", "pick"], 0],
            layout: {
              "text-field": ["to-string", ["get", "pick"]],
              "text-size": 10,
              "text-font": ["Noto Sans Bold"],
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#ffffff" },
          });
          map.on("click", "events-dots", (event) => {
            const id = event.features?.[0]?.properties?.eventId;
            if (typeof id === "string") scrollStripTo(stripRef.current, id);
          });
          map.on("mouseenter", "events-dots", () => map && (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "events-dots", () => map && (map.getCanvas().style.cursor = ""));
        });
      })
      .catch(() => setMapFailed(true));

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is built once; cards update through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the heat in step with new picks.
  useEffect(() => {
    const source = mapRef.current?.getSource("events") as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(cards));
  }, [cards]);

  // Follow the student's real location. The first fix centers the map.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let centered = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const next = { point, live: true };
        locationRef.current = next;
        setLocation(next);
        userMarkerRef.current?.setLngLat([point.lng, point.lat]);
        if (!centered) {
          centered = true;
          mapRef.current?.jumpTo({ center: [point.lng, point.lat], zoom: USER_ZOOM });
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const recenter = useCallback(() => {
    const { point } = locationRef.current;
    mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: USER_ZOOM + 0.4, duration: 700 });
  }, []);

  // When the strip settles on a card, fly to its event.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-event-id");
        if (id) setActiveId(id);
      },
      { root: strip, threshold: [0.6, 0.9] },
    );
    strip.querySelectorAll("[data-event-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [cards]);

  const firstActive = useRef(true);
  useEffect(() => {
    if (firstActive.current) {
      firstActive.current = false;
      return;
    }
    const card = cards.find((item) => item.eventId === activeId);
    if (card) mapRef.current?.easeTo({ center: [card.place.lng, card.place.lat], duration: 500 });
  }, [activeId, cards]);

  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] relative h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full overflow-hidden bg-wash">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" aria-label="Map of events near you" role="region" />
      </div>

      {mapFailed && (
        <p className="absolute inset-x-3 top-3 rounded-card bg-card px-3 py-2 text-body text-muted shadow">
          The map could not load. The events are still listed below.
        </p>
      )}

      <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-[5px] rounded-full bg-card/95 px-[10px] py-[6px] text-meta font-semibold text-ink shadow-sm">
        <MuseMark className="h-[13px] w-[13px] text-primary" />
        {museLive ? "Hotspots picked by Muse for you" : "Recorded picks while Muse is offline"}
      </p>

      <button
        type="button"
        onClick={recenter}
        aria-label="Recenter on my location"
        className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary shadow-md active:scale-95"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 170px)" }}
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden fill="currentColor">
          <path d="M21 3 3 10.5l7.5 3 3 7.5L21 3Z" />
        </svg>
      </button>
      {!location.live && (
        <p
          className="pointer-events-none absolute right-16 rounded-full bg-card/95 px-[10px] py-[5px] text-meta font-semibold text-muted shadow-sm"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 178px)" }}
        >
          Location off, showing campus
        </p>
      )}

      <ol
        ref={stripRef}
        aria-label="Events on the map"
        className="no-scrollbar absolute inset-x-0 z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 12px)" }}
      >
        {cards.map((card) => (
          <li key={card.eventId} data-event-id={card.eventId} className="w-[300px] shrink-0 snap-start">
            <Link
              href={`/events/${card.eventId}`}
              className={`flex h-[146px] overflow-hidden rounded-card border bg-card shadow-md transition-colors ${
                activeId === card.eventId ? "border-primary" : "border-hairline"
              }`}
            >
              <div className="w-[96px] shrink-0 overflow-hidden">
                <Poster seed={card.eventId} title="" size="small" className="h-full !aspect-auto" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col px-[10px] py-[9px]">
                <p className="truncate text-meta font-semibold text-muted">{card.dateLine}</p>
                <h3 className="mt-[2px] line-clamp-2 font-display text-label font-bold">{card.title}</h3>
                <p className="mt-[1px] truncate text-meta font-semibold text-muted">
                  {walkMinutes(location.point, card.place)} min walk · {card.free ? "Free" : "Paid entry"}
                </p>
                {card.reason && (
                  <p className="mt-auto flex items-start gap-[5px] pt-[4px] text-venue font-semibold text-ink">
                    <MuseMark className="mt-[1.5px] h-[13px] w-[13px] shrink-0 text-primary" />
                    <span className="line-clamp-2">{card.reason}</span>
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
