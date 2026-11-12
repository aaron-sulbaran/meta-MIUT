"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import type { Map as MapLibreMap, GeoJSONSource, Marker } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_TINTS, initials } from "@/components/map/category-icons";
import { CloseIcon, MuseMark } from "@/components/ui/icons";
import { walkMinutes } from "@/lib/geo";
import type { Category } from "@/lib/map/category";

// Full-screen heatmap for the Events tab. Hotspots are where Muse's picks for
// this student are (lib/map/heat.ts). Each event sits on the map as a round
// bubble with the organizer's flyer (initials on a tint when there is none) and
// a small icon badge for what it is (lib/map/category.ts); the selected event
// shows its name in a small pill underneath. For the
// demo the student stands at a fixed campus spot (their profile's home), never
// live GPS, so the map looks right wherever we present from.
// Chips along the top filter the map and cards. A swipeable strip of cards
// sits at the bottom: swiping flies the map to that event, tapping a bubble
// scrolls the strip to its card. X hides an event ("Not for me") and cools its
// hotspot. Directions opens walking directions in the phone's maps app.
// Tiles: OpenFreeMap "liberty" (OpenStreetMap data, no key), softened on load.

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Starting view before the map frames the student and their picks.
const STUDENT_ZOOM = 14.6;
// Below this zoom only the selected event shows its name pill, so close
// bubbles do not pile up their labels.
const LABEL_ZOOM = 16.2;
const DISMISSED_KEY = "map:dismissed";

type Point = { lat: number; lng: number };

export type MapChip = "freeFood" | "now" | "today";

const CHIPS: { id: "all" | MapChip; label: string }[] = [
  { id: "all", label: "For you" },
  { id: "freeFood", label: "Free food" },
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
];

export type MapCard = {
  eventId: string;
  title: string;
  place: Point & { name: string };
  dateLine: string;
  free: boolean;
  category: Category;
  imagePath: string | null;
  chips: MapChip[];
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

function shortName(title: string): string {
  return title.length > 18 ? `${title.slice(0, 17).trimEnd()}...` : title;
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

// Soften the base map toward the references: quiet buildings, no shop and
// transit icons, no 3D, so the bubbles and heat carry the color.
const BASE = {
  land: "#f2f2f2",
  building: "#e8e8e8",
  road: "#ffffff",
  roadEdge: "#e4e4e4",
  water: "#d6e6f2",
  waterLine: "#c4dbec",
  green: "#e2eedf",
  label: "#9b9b9b",
  waterLabel: "#8aa9c2",
};

const HIDDEN_FILLS = new Set(["road_area_pattern", "landcover_sand", "landcover_ice", "landcover_wetland", "landuse_pitch", "landuse_track", "aeroway_fill"]);

// Restyle the base map after the reference: flat light grey land, white
// roads, soft blue water, a hint of green, quiet grey labels, nothing else.
// The bubbles and heat carry all the color.
function softenBaseMap(map: MapLibreMap) {
  const set = (id: string, property: string, value: string | number) => {
    try {
      map.setPaintProperty(id, property, value);
    } catch {
      // A property the layer does not have; skip it.
    }
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    const hide = () => map.setLayoutProperty(id, "visibility", "none");
    if (layer.type === "fill-extrusion" || layer.type === "raster") hide();
    else if (layer.type === "background") set(id, "background-color", BASE.land);
    else if (layer.type === "fill") {
      if (HIDDEN_FILLS.has(id)) hide();
      else if (id === "water") set(id, "fill-color", BASE.water);
      else if (id === "building") {
        set(id, "fill-color", BASE.building);
        set(id, "fill-outline-color", BASE.building);
      } else if (id === "park" || id.startsWith("landcover")) {
        set(id, "fill-color", BASE.green);
        set(id, "fill-opacity", 1);
      } else set(id, "fill-color", BASE.land);
    } else if (layer.type === "line") {
      if (id.includes("rail") || id.includes("hatching") || id.includes("aeroway") || id.includes("boundary") || id === "park_outline") hide();
      else if (id.startsWith("waterway")) set(id, "line-color", BASE.waterLine);
      else if (id.includes("casing")) set(id, "line-color", BASE.roadEdge);
      else if (/road|bridge|tunnel|highway/.test(id)) set(id, "line-color", BASE.road);
    } else if (layer.type === "symbol") {
      if (id.startsWith("poi") || id.includes("shield") || id.includes("airport") || id.includes("arrow") || id.startsWith("label_country")) hide();
      else {
        const water = id.startsWith("water");
        set(id, "text-color", water ? BASE.waterLabel : BASE.label);
        set(id, "text-halo-color", water ? BASE.water : BASE.land);
        set(id, "text-halo-width", 1.2);
      }
    }
  }
}

// Keep the student in the middle and zoom out just far enough to show Muse's
// picks around them (a box mirrored around the student), clear of the chips
// on top and the card strip below.
function frameStudent(map: MapLibreMap, studentSpot: Point, cards: MapCard[], animate: boolean) {
  const picks = cards.filter((card) => card.pickRank !== null);
  const around = picks.length > 0 ? picks : cards.slice(0, 3);
  const dLat = Math.max(0.004, ...around.map((card) => Math.abs(card.place.lat - studentSpot.lat)));
  const dLng = Math.max(0.004, ...around.map((card) => Math.abs(card.place.lng - studentSpot.lng)));
  map.fitBounds(
    [
      [studentSpot.lng - dLng, studentSpot.lat - dLat],
      [studentSpot.lng + dLng, studentSpot.lat + dLat],
    ],
    { padding: { top: 110, bottom: 200, left: 36, right: 36 }, maxZoom: 16, duration: animate ? 700 : 0 },
  );
}

// The bubble's fallback when there is no flyer or it fails to load: the
// event's initials on a soft tint for its kind of event.
function fillWithInitials(target: HTMLElement, card: MapCard, size: number) {
  const tint = CATEGORY_TINTS[card.category];
  target.replaceChildren();
  target.textContent = initials(card.title);
  Object.assign(target.style, {
    background: tint.fill,
    color: tint.ink,
    font: `600 ${Math.round(size * 0.34)}px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif`,
    letterSpacing: "0.02em",
  });
}

// MapLibre positions a marker by setting transform on the element it is given,
// so everything styled sits inside a plain wrapper and only the inner part scales.
function markerElement(card: MapCard, onPick: (eventId: string) => void): HTMLDivElement {
  const pick = card.pickRank !== null;
  const size = pick ? 46 : 36;
  const wrapper = document.createElement("div");
  wrapper.dataset.pick = pick ? "1" : "0";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `${CATEGORY_LABELS[card.category]}: ${card.title}`);
  Object.assign(button.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    background: "none",
    border: "0",
    padding: "0",
    cursor: "pointer",
    transformOrigin: "50% 100%",
    transition: "transform 160ms ease",
  });

  // The bubble: flyer photo in a white ring. Muse's picks get a thin warm
  // outer ring so they read as recommended without shouting.
  const bubble = document.createElement("span");
  Object.assign(bubble.style, { position: "relative", display: "block", width: `${size}px`, height: `${size}px` });
  const photo = document.createElement("span");
  Object.assign(photo.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    overflow: "hidden",
    border: `${pick ? 3 : 2.5}px solid #ffffff`,
    boxShadow: pick ? "0 0 0 2px #e8603c, 0 2px 6px rgba(0,0,0,0.25)" : "0 1px 5px rgba(0,0,0,0.25)",
    boxSizing: "border-box",
    background: "#e8e8e8",
  });
  if (card.imagePath) {
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.src = card.imagePath;
    Object.assign(image.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
    image.addEventListener("error", () => fillWithInitials(photo, card, size), { once: true });
    photo.appendChild(image);
  } else {
    fillWithInitials(photo, card, size);
  }
  bubble.appendChild(photo);

  // A small line icon badge says what kind of event it is.
  const badgeSize = pick ? 19 : 17;
  const badge = document.createElement("span");
  badge.innerHTML = CATEGORY_ICONS[card.category];
  Object.assign(badge.style, {
    position: "absolute",
    right: "-4px",
    bottom: "-3px",
    width: `${badgeSize}px`,
    height: `${badgeSize}px`,
    padding: "3px",
    boxSizing: "border-box",
    borderRadius: "9999px",
    background: "#ffffff",
    color: "#444441",
    boxShadow: "0 0 0 0.5px #d3d1c7, 0 1px 2px rgba(0,0,0,0.15)",
  });
  bubble.appendChild(badge);
  button.appendChild(bubble);

  const label = document.createElement("span");
  label.className = "event-marker-label";
  label.textContent = shortName(card.title);
  Object.assign(label.style, {
    maxWidth: "140px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    borderRadius: "9999px",
    background: "#ffffff",
    padding: "3px 9px",
    font: "600 11.5px/1.3 -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    color: "#2c2c2a",
    boxShadow: "0 0 0 0.5px #d3d1c7, 0 1px 3px rgba(0,0,0,0.12)",
  });
  button.appendChild(label);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onPick(card.eventId);
  });
  wrapper.appendChild(button);
  return wrapper;
}

function setMarkerActive(wrapper: HTMLElement, active: boolean) {
  const button = wrapper.firstElementChild as HTMLElement | null;
  if (button) button.style.transform = active ? "scale(1.18)" : "scale(1)";
  wrapper.style.zIndex = active ? "3" : wrapper.dataset.pick === "1" ? "2" : "1";
  wrapper.dataset.active = active ? "1" : "0";
}

function setLabelsForZoom(markers: Map<string, { element: HTMLElement }>, zoom: number) {
  for (const { element } of markers.values()) {
    const label = element.querySelector<HTMLElement>(".event-marker-label");
    if (label) label.style.display = element.dataset.active === "1" || zoom >= LABEL_ZOOM ? "block" : "none";
  }
}

// The card's picture: the same flyer (or initials) and icon badge as the
// bubble on the map, as a rounded square.
function FlyerTile({ card }: { card: MapCard }) {
  const [failed, setFailed] = useState(false);
  const tint = CATEGORY_TINTS[card.category];
  const showPhoto = card.imagePath !== null && !failed;
  return (
    <div className="relative h-[64px] w-[64px] shrink-0" aria-hidden>
      {showPhoto ? (
        // Flyers arrive as remote poster links or small stored images, so a
        // plain img (not next/image) keeps both working without config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imagePath ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-[14px] object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-[14px] text-[20px] font-semibold tracking-[0.02em]"
          style={{ backgroundColor: tint.fill, color: tint.ink }}
        >
          {initials(card.title)}
        </div>
      )}
      <span
        className="absolute -bottom-[4px] -right-[4px] block h-[22px] w-[22px] rounded-full bg-white p-[4px] text-[#444441] shadow-[0_0_0_0.5px_#d3d1c7,0_1px_2px_rgba(0,0,0,0.15)]"
        // Our own static SVG from category-icons.ts, never event text.
        dangerouslySetInnerHTML={{ __html: CATEGORY_ICONS[card.category] }}
      />
    </div>
  );
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
  const interacted = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [chip, setChip] = useState<"all" | MapChip>("all");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lastDismissed, setLastDismissed] = useState<MapCard | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const visibleCards = useMemo(
    () => cards.filter((card) => !dismissed.includes(card.eventId) && (chip === "all" || card.chips.includes(chip))),
    [cards, dismissed, chip],
  );
  const currentActive =
    activeId && visibleCards.some((card) => card.eventId === activeId) ? activeId : (visibleCards[0]?.eventId ?? null);

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
        if (corner) corner.style.bottom = "calc(var(--tabbar-height) + var(--tabbar-gap) + 160px)";
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
        map.on("zoom", () => map && setLabelsForZoom(markersRef.current, map.getZoom()));

        map.on("load", () => {
          if (!map) return;
          container.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
          softenBaseMap(map);
          frameStudent(map, studentSpot, cards, false);
          map.addSource("events", { type: "geojson", data: toFeatureCollection([]) });
          map.addLayer({
            id: "events-heat",
            type: "heatmap",
            source: "events",
            paint: {
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 1.6, 15, 2.4, 17, 3],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 26, 14.5, 62, 17, 115],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.85, 18, 0.65],
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
                "rgba(255,165,50,0.6)",
                0.65,
                "rgba(246,104,44,0.74)",
                0.85,
                "rgba(230,57,70,0.82)",
                1,
                "rgba(200,20,90,0.9)",
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
    // The map is built once; cards, chips and dismissals update through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heat and bubbles follow the visible cards.
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
      const marker = new MarkerClass({ element, anchor: "bottom" }).setLngLat([card.place.lng, card.place.lat]).addTo(map);
      markers.set(card.eventId, { marker, element });
    }
    setLabelsForZoom(markers, map.getZoom());
  }, [mapReady, visibleCards]);

  // The active event's bubble grows a little.
  useEffect(() => {
    for (const [id, { element }] of markersRef.current) setMarkerActive(element, id === currentActive);
    if (mapRef.current) setLabelsForZoom(markersRef.current, mapRef.current.getZoom());
  }, [currentActive, mapReady, visibleCards]);

  const recenter = useCallback(() => {
    if (mapRef.current) frameStudent(mapRef.current, studentSpot, visibleCards, true);
  }, [studentSpot, visibleCards]);

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

  // Fly to the active event once the student swipes or taps a bubble; the map
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
        <p className="absolute inset-x-3 top-24 z-10 rounded-card bg-card px-3 py-2 text-body text-muted shadow">
          The map could not load. The events are still listed below.
        </p>
      )}

      <div
        role="group"
        aria-label="Filter the map"
        className="no-scrollbar absolute left-0 right-[124px] top-3 z-10 flex gap-[6px] overflow-x-auto pl-3 pr-2"
      >
        {CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={chip === item.id}
            onClick={() => {
              setChip(item.id);
              setLastDismissed(null);
            }}
            className={`shrink-0 rounded-full px-[12px] py-[6px] text-meta font-semibold shadow-sm ${
              chip === item.id ? "bg-ink text-white" : "bg-card text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="pointer-events-none absolute left-3 top-[52px] z-10 flex items-center gap-[5px] rounded-full bg-card/95 px-[10px] py-[5px] text-[12px] font-semibold text-muted shadow-sm">
        <MuseMark className="h-[12px] w-[12px] text-primary" />
        {museLive ? "Heat shows Muse's picks for you" : "Recorded picks while Muse is offline"}
      </p>

      <button
        type="button"
        onClick={recenter}
        aria-label="Recenter on my location"
        className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-md active:scale-95"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 110px)" }}
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
      </button>

      {lastDismissed && (
        <div
          role="status"
          className="absolute left-3 z-10 flex items-center gap-3 rounded-full bg-ink px-[14px] py-[8px] text-meta font-semibold text-white shadow-md"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 116px)" }}
        >
          <span className="max-w-[170px] truncate">Hidden: {lastDismissed.title}</span>
          <button type="button" onClick={undoDismiss} className="text-primary-soft underline">
            Undo
          </button>
        </div>
      )}

      {visibleCards.length === 0 && (
        <p
          className="absolute inset-x-3 z-10 rounded-[18px] bg-card px-3 py-3 text-center text-body text-muted shadow-md"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 12px)" }}
        >
          {chip === "all" ? "You hid every event. New ones show up here as clubs post them." : "Nothing here right now. Try For you."}
        </p>
      )}

      <ol
        ref={stripRef}
        onPointerDown={() => (interacted.current = true)}
        onWheel={() => (interacted.current = true)}
        onKeyDown={() => (interacted.current = true)}
        aria-label="Events on the map"
        className="no-scrollbar absolute inset-x-0 z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3 pb-1"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 10px)" }}
      >
        {visibleCards.map((card) => (
          <li key={card.eventId} data-event-id={card.eventId} className="w-[310px] shrink-0 snap-start">
            <article
              className={`relative flex items-center gap-[10px] rounded-[18px] border-[1.5px] bg-card p-[10px] pr-[30px] shadow-md transition-colors ${
                currentActive === card.eventId ? "border-[#ff7a45]" : "border-transparent"
              }`}
            >
              <FlyerTile card={card} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-label font-bold">
                  <Link href={`/events/${card.eventId}`} className="after:absolute after:inset-0">
                    {card.title}
                  </Link>
                </h3>
                <p className="truncate text-meta font-semibold text-muted">{card.dateLine}</p>
                <p className="mt-[3px] flex items-center gap-[6px] text-meta font-semibold text-muted">
                  <span className="truncate">
                    {walkMinutes(studentSpot, card.place)} min walk · {card.free ? "Free" : "Paid"}
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
                  <p className="mt-[4px] flex items-start gap-[5px] text-[12px] font-semibold leading-[15px] text-ink">
                    <MuseMark className="mt-[1px] h-[12px] w-[12px] shrink-0 text-primary" />
                    <span className="truncate">{card.reason}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(card)}
                aria-label={`Not for me: hide ${card.title}`}
                className="absolute right-[6px] top-[6px] z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-muted hover:bg-wash"
              >
                <CloseIcon className="h-[13px] w-[13px]" />
              </button>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
