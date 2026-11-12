"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import type { Map as MapLibreMap, GeoJSONSource, Marker } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/components/map/category-icons";
import { CloseIcon, MuseMark } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { walkMinutes } from "@/lib/geo";
import type { Category } from "@/lib/map/category";

// Full-screen heatmap for the Events tab. Hotspots are where Muse's picks for
// this student are (see lib/map/heat.ts); each event is marked with an icon
// for what it is (lib/map/category.ts). For the demo the student stands at a
// fixed campus spot (their profile's home), never live GPS, so the map looks
// right wherever we present from.
// A swipeable strip of event cards sits at the bottom: swiping flies the map
// to that event, tapping a marker scrolls the strip to its card. X hides an
// event ("Not for me") and cools its hotspot. Directions opens walking
// directions in the phone's maps app.
// Tiles: OpenFreeMap "liberty" (OpenStreetMap data, no key), drawn with MapLibre GL.

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// About a one-mile view around the student, the walking range for free food.
const STUDENT_ZOOM = 14.4;
const DISMISSED_KEY = "map:dismissed";

type Point = { lat: number; lng: number };

export type MapCard = {
  eventId: string;
  title: string;
  place: Point & { name: string };
  dateLine: string;
  free: boolean;
  category: Category;
  weight: number;
  pickRank: number | null;
  reason: string | null;
};

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
      properties: { eventId: card.eventId, weight: card.weight },
      geometry: { type: "Point" as const, coordinates: [card.place.lng, card.place.lat] },
    })),
  };
}

function directionsUrl(from: Point, to: Point): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked; dismissals then last for this visit only.
  }
}

// MapLibre positions a marker by setting transform on the element it is given,
// so the styled button sits inside a plain wrapper and only the button scales.
function markerElement(card: MapCard, onPick: (eventId: string) => void): HTMLDivElement {
  const pick = card.pickRank !== null;
  const wrapper = document.createElement("div");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `${CATEGORY_LABELS[card.category]}: ${card.title}`);
  button.innerHTML = CATEGORY_ICONS[card.category];
  Object.assign(button.style, {
    display: "block",
    width: pick ? "38px" : "30px",
    height: pick ? "38px" : "30px",
    padding: pick ? "7px" : "6px",
    borderRadius: "9999px",
    background: "#ffffff",
    color: pick ? "#e0442e" : "#65676b",
    border: pick ? "2.5px solid #e0442e" : "1.5px solid #d4d6d8",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
    cursor: "pointer",
    transition: "transform 150ms ease",
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onPick(card.eventId);
  });
  wrapper.appendChild(button);
  return wrapper;
}

function setMarkerActive(wrapper: HTMLElement, active: boolean) {
  const button = wrapper.firstElementChild as HTMLElement | null;
  if (button) button.style.transform = active ? "scale(1.25)" : "scale(1)";
  wrapper.style.zIndex = active ? "2" : "1";
}

export function EventsHeatmap({
  cards,
  studentSpot,
  museLive,
}: {
  cards: MapCard[];
  studentSpot: Point;
  museLive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerClassRef = useRef<typeof Marker | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; element: HTMLElement }>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lastDismissed, setLastDismissed] = useState<MapCard | null>(null);
  const interacted = useRef(false);

  const visibleCards = useMemo(() => cards.filter((card) => !dismissed.includes(card.eventId)), [cards, dismissed]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const currentActive = activeId && visibleCards.some((card) => card.eventId === activeId) ? activeId : (visibleCards[0]?.eventId ?? null);

  // Dismissals survive a reload on this device.
  useEffect(() => {
    const saved = readDismissed();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (saved.length > 0) setDismissed(saved);
  }, []);

  // Build the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    void import("maplibre-gl")
      .then((maplibre) => {
        if (cancelled) return;
        const maplibregl = maplibre.default;
        markerClassRef.current = maplibregl.Marker;
        map = new maplibregl.Map({
          container,
          style: STYLE_URL,
          center: [studentSpot.lng, studentSpot.lat],
          zoom: STUDENT_ZOOM,
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
        new maplibregl.Marker({ element: dot }).setLngLat([studentSpot.lng, studentSpot.lat]).addTo(map);

        map.on("error", (event) => {
          if (String(event.error?.message ?? "").includes("style")) setMapFailed(true);
        });

        map.on("load", () => {
          if (!map) return;
          container.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
          map.addSource("events", { type: "geojson", data: toFeatureCollection([]) });
          map.addLayer({
            id: "events-heat",
            type: "heatmap",
            source: "events",
            paint: {
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 1.6, 15, 2.4, 17, 3],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 26, 14.5, 58, 17, 110],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.85, 18, 0.7],
              // Warm ramp so it stands out from the blue water and green parks.
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(255,214,90,0)",
                0.15,
                "rgba(255,214,90,0.4)",
                0.4,
                "rgba(255,165,50,0.62)",
                0.65,
                "rgba(246,104,44,0.78)",
                0.85,
                "rgba(230,57,70,0.86)",
                1,
                "rgba(200,20,90,0.92)",
              ],
            },
          });
          setMapReady(true);
        });
      })
      .catch(() => setMapFailed(true));

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
    // The map is built once; cards and dismissals update through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heat and markers follow the visible cards.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClassRef.current;
    if (!mapReady || !map || !MarkerClass) return;
    (map.getSource("events") as GeoJSONSource | undefined)?.setData(toFeatureCollection(visibleCards));

    const markers = markersRef.current;
    const keep = new Set(visibleCards.map((card) => card.eventId));
    for (const [id, entry] of markers) {
      if (!keep.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
    for (const card of visibleCards) {
      if (markers.has(card.eventId)) continue;
      const element = markerElement(card, (id) => {
        interacted.current = true;
        setActiveId(id);
        scrollStripTo(stripRef.current, id);
      });
      const marker = new MarkerClass({ element }).setLngLat([card.place.lng, card.place.lat]).addTo(map);
      markers.set(card.eventId, { marker, element });
    }
  }, [mapReady, visibleCards]);

  // The active event's marker grows a little.
  useEffect(() => {
    for (const [id, { element }] of markersRef.current) {
      setMarkerActive(element, id === currentActive);
    }
  }, [currentActive, mapReady, visibleCards]);

  const recenter = useCallback(() => {
    mapRef.current?.flyTo({ center: [studentSpot.lng, studentSpot.lat], zoom: STUDENT_ZOOM + 0.4, duration: 700 });
  }, [studentSpot]);

  const dismiss = useCallback(
    (card: MapCard) => {
      const next = [...dismissed, card.eventId];
      setDismissed(next);
      writeDismissed(next);
      setLastDismissed(card);
    },
    [dismissed],
  );

  const undoDismiss = useCallback(() => {
    if (!lastDismissed) return;
    const next = dismissed.filter((id) => id !== lastDismissed.eventId);
    setDismissed(next);
    writeDismissed(next);
    setLastDismissed(null);
  }, [dismissed, lastDismissed]);

  // When the strip settles on a card, make it active.
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
  }, [visibleCards]);

  // Fly to the active event once the student swipes or taps a marker; the map
  // opens on the student, not on the first card.
  useEffect(() => {
    if (!activeId || !interacted.current) return;
    const card = visibleCards.find((item) => item.eventId === activeId);
    if (card) mapRef.current?.easeTo({ center: [card.place.lng, card.place.lat], duration: 500 });
  }, [activeId, visibleCards]);

  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] relative h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full overflow-hidden bg-wash">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" aria-label="Map of events near you" role="region" />
      </div>

      {mapFailed && (
        <p className="absolute inset-x-3 top-14 z-10 rounded-card bg-card px-3 py-2 text-body text-muted shadow">
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

      {lastDismissed && (
        <div
          role="status"
          className="absolute left-3 z-10 flex items-center gap-3 rounded-full bg-ink px-[14px] py-[8px] text-meta font-semibold text-white shadow-md"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 176px)" }}
        >
          <span className="max-w-[170px] truncate">Hidden: {lastDismissed.title}</span>
          <button type="button" onClick={undoDismiss} className="text-primary-soft underline">
            Undo
          </button>
        </div>
      )}

      {visibleCards.length === 0 && (
        <p
          className="absolute inset-x-3 z-10 rounded-card bg-card px-3 py-3 text-center text-body text-muted shadow-md"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 12px)" }}
        >
          You hid every event. New ones show up here as clubs post them.
        </p>
      )}

      <ol
        ref={stripRef}
        onPointerDown={() => (interacted.current = true)}
        onWheel={() => (interacted.current = true)}
        onKeyDown={() => (interacted.current = true)}
        aria-label="Events on the map"
        className="no-scrollbar absolute inset-x-0 z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 12px)" }}
      >
        {visibleCards.map((card) => (
          <li key={card.eventId} data-event-id={card.eventId} className="w-[300px] shrink-0 snap-start">
            <article
              className={`relative flex h-[146px] overflow-hidden rounded-card border bg-card shadow-md transition-colors ${
                currentActive === card.eventId ? "border-primary" : "border-hairline"
              }`}
            >
              <div className="w-[72px] shrink-0 overflow-hidden">
                <Poster seed={card.eventId} title="" size="small" className="h-full !aspect-auto" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-[9px] pl-[10px] pr-[30px]">
                <p className="truncate text-meta font-semibold text-muted">{card.dateLine}</p>
                <h3 className="mt-[2px] line-clamp-2 font-display text-label font-bold">
                  <Link href={`/events/${card.eventId}`} className="after:absolute after:inset-0">
                    {card.title}
                  </Link>
                </h3>
                <p className="mt-[1px] flex items-center gap-[6px] text-meta font-semibold text-muted">
                  <span className="truncate">
                    {walkMinutes(studentSpot, card.place)} min walk · {card.free ? "Free" : "Paid entry"}
                  </span>
                  <a
                    href={directionsUrl(studentSpot, card.place)}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-10 shrink-0 rounded-full bg-primary-soft px-[8px] py-[2px] text-primary"
                  >
                    Directions
                  </a>
                </p>
                {card.reason && (
                  <p className="mt-auto flex items-start gap-[5px] pt-[4px] text-venue font-semibold text-ink">
                    <MuseMark className="mt-[1.5px] h-[13px] w-[13px] shrink-0 text-primary" />
                    <span className="line-clamp-2">{card.reason}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(card)}
                aria-label={`Not for me: hide ${card.title}`}
                className="absolute right-[4px] top-[4px] z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-muted hover:bg-wash"
              >
                <CloseIcon className="h-[14px] w-[14px]" />
              </button>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
