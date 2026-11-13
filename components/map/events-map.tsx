"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_TINTS, monogram } from "@/components/map/category-icons";
import { CrawlPlanner } from "@/components/map/crawl-planner";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { walkMinutes } from "@/lib/geo";
import type { Category } from "@/lib/map/category";
import type { Route } from "@/lib/map/crawl-route";

// Full-screen map for the Events tab: a clean, quiet base map with each event
// as a round bubble showing the organizer's logo (the club, association or
// business), or their monogram on a soft tint until a logo is set, plus a
// small icon badge for what the event is (lib/map/category.ts). Muse's picks
// (lib/map/heat.ts orders them) get a slightly larger bubble with a thin warm
// ring. The selected event shows its name in a small pill. For the demo the
// student stands at a fixed campus spot (their profile's home), never live GPS.
// Chips along the top filter the map and cards. A swipeable strip of cards
// sits at the bottom: swiping flies the map to that event, tapping a bubble
// scrolls the strip to its card. X hides an event ("Not for me") and, after
// the Undo window, Muse learns from it. Directions opens walking directions.
// Tiles: OpenFreeMap "liberty" (OpenStreetMap data, no key), restyled on load.

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Starting view before the map frames the student and their picks.
const STUDENT_ZOOM = 14.6;
// Below this zoom only the selected event shows its name pill, so close
// bubbles do not pile up their labels.
const LABEL_ZOOM = 16.2;
const DISMISSED_KEY = "map:dismissed";
// How long Undo stays up before Muse learns from a Not for me.
const UNDO_MS = 5000;

type Point = { lat: number; lng: number };

export type MapChip = "forYou" | "free";

const CHIPS: { id: MapChip; label: string }[] = [
  { id: "forYou", label: "For you" },
  { id: "free", label: "Free" },
];

export type MapCard = {
  eventId: string;
  title: string;
  place: Point & { name: string };
  dateLine: string;
  free: boolean;
  category: Category;
  organizerName: string;
  /** The organizer's logo image, when the event data has one. */
  logoUrl: string | null;
  chips: MapChip[];
  startIso: string;
  endIso: string;
  weight: number;
  pickRank: number | null;
  reason: string | null;
};

// Bring a card into place in the strip. A neighbor glides; a card further
// away jumps straight there, so the strip never races past every card between.
function scrollStripTo(strip: HTMLElement | null, eventId: string) {
  const card = strip?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
  if (!strip || !card) return;
  const left = card.offsetLeft - 12;
  const far = Math.abs(left - strip.scrollLeft) > card.offsetWidth * 1.5;
  strip.scrollTo({ left, behavior: far ? "instant" : "smooth" });
}

// The card the strip has settled on: the one whose left edge is closest to
// the strip's left padding.
function settledCardId(strip: HTMLElement): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const element of strip.querySelectorAll<HTMLElement>("[data-event-id]")) {
    const distance = Math.abs(element.offsetLeft - 12 - strip.scrollLeft);
    if (!best || distance < best.distance) best = { id: element.dataset.eventId ?? "", distance };
  }
  return best?.id || null;
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
// transit icons, no 3D, so the bubbles carry the color.
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
// The bubbles carry all the color.
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
    { padding: { top: 70, bottom: 230, left: 36, right: 36 }, maxZoom: 16, duration: animate ? 700 : 0 },
  );
}

// The bubble's fallback when there is no logo or it fails to load: the
// organizer's monogram on a soft tint for the kind of event.
function fillWithInitials(target: HTMLElement, card: MapCard, size: number) {
  const tint = CATEGORY_TINTS[card.category];
  target.replaceChildren();
  target.textContent = monogram(card.organizerName);
  Object.assign(target.style, {
    background: tint.fill,
    color: tint.ink,
    font: `600 ${Math.round(size * 0.3)}px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif`,
    letterSpacing: "0.02em",
  });
}

// MapLibre positions a marker by setting transform on the element it is given,
// so everything styled sits inside a plain wrapper and only the inner part scales.
function markerElement(card: MapCard, onPick: (eventId: string) => void): HTMLDivElement {
  const pick = card.pickRank !== null;
  // Every bubble is one size; only the selected one grows (setMarkerActive).
  const size = 38;
  const wrapper = document.createElement("div");
  wrapper.dataset.pick = pick ? "1" : "0";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `${CATEGORY_LABELS[card.category]}: ${card.title}, by ${card.organizerName}`);
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

  // The bubble: the organizer's logo in a white ring. It grows from its bottom
  // edge when selected, so it stays anchored on the event's spot.
  const bubble = document.createElement("span");
  Object.assign(bubble.style, {
    position: "relative",
    display: "block",
    width: `${size}px`,
    height: `${size}px`,
    transformOrigin: "50% 100%",
    transition: "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2)",
  });
  const photo = document.createElement("span");
  Object.assign(photo.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    overflow: "hidden",
    border: "2.5px solid #ffffff",
    boxShadow: "0 1px 5px rgba(0,0,0,0.25)",
    transition: "box-shadow 200ms ease",
    boxSizing: "border-box",
    background: "#ffffff",
  });
  if (card.logoUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.src = card.logoUrl;
    // Logos are usually square marks: contain them on white with a little air.
    Object.assign(image.style, { width: "100%", height: "100%", objectFit: "contain", padding: "3px", boxSizing: "border-box", display: "block" });
    image.addEventListener("error", () => fillWithInitials(photo, card, size), { once: true });
    photo.appendChild(image);
  } else {
    fillWithInitials(photo, card, size);
  }
  bubble.appendChild(photo);

  // A small line icon badge says what kind of event it is.
  const badgeSize = 17;
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

// The selected event's bubble grows to well over one and a half times its
// size and lifts with a deeper shadow; its name pill stays readable below.
// The food crawl's route: a dotted line from the student through each stop to
// where the walk ends, with numbered stop markers and a home marker.
const ROUTE_SOURCE = "crawl-route";

function routeLine(route: Route) {
  const points = [route.from, ...route.stops, route.destination];
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: points.map((point) => [point.lng, point.lat]) },
  };
}

function routeMarkerElement(label: string, home: boolean): HTMLDivElement {
  const element = document.createElement("div");
  element.textContent = home ? "" : label;
  if (home) {
    element.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10"/></svg>';
  }
  element.setAttribute("aria-label", home ? "Where the walk ends" : `Stop ${label}`);
  Object.assign(element.style, {
    width: "28px",
    height: "28px",
    borderRadius: "9999px",
    background: home ? "#2c2c2a" : "#1e6b33",
    color: "#ffffff",
    border: "2.5px solid #ffffff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    font: "700 12px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  });
  return element;
}

// While a crawl is on the map, events off the route fade and bubbles stop
// taking taps, so the route reads clearly.
// MapLibre manages the marker element's own opacity, so fade the bubble inside.
function setMarkerFaded(element: HTMLElement, faded: boolean, locked: boolean) {
  const inner = element.firstElementChild as HTMLElement | null;
  if (inner) inner.style.opacity = faded ? "0.3" : "1";
  element.style.pointerEvents = locked ? "none" : "";
}

function setMarkerActive(wrapper: HTMLElement, active: boolean) {
  const bubble = wrapper.querySelector<HTMLElement>("button > span");
  const photo = bubble?.firstElementChild as HTMLElement | null;
  if (bubble) bubble.style.transform = active ? "scale(1.7)" : "scale(1)";
  if (photo) photo.style.boxShadow = active ? "0 6px 16px rgba(0,0,0,0.32)" : "0 1px 5px rgba(0,0,0,0.25)";
  wrapper.style.zIndex = active ? "3" : "1";
  wrapper.dataset.active = active ? "1" : "0";
}

function setLabelsForZoom(markers: Map<string, { element: HTMLElement }>, zoom: number) {
  for (const { element } of markers.values()) {
    const label = element.querySelector<HTMLElement>(".event-marker-label");
    if (label) label.style.display = element.dataset.active === "1" || zoom >= LABEL_ZOOM ? "block" : "none";
  }
}

// The card's picture: the same logo (or monogram) and icon badge as the
// bubble on the map, as a rounded square.
function LogoTile({ card }: { card: MapCard }) {
  const [failed, setFailed] = useState(false);
  const tint = CATEGORY_TINTS[card.category];
  const showLogo = card.logoUrl !== null && !failed;
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" aria-hidden>
      {showLogo ? (
        // Logos arrive as remote links or small stored images, so a plain img
        // (not next/image) keeps both working without config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.logoUrl ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-[16px] border border-hairline bg-white object-contain p-[6px]"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-[16px] text-[19px] font-semibold tracking-[0.02em]"
          style={{ backgroundColor: tint.fill, color: tint.ink }}
        >
          {monogram(card.organizerName)}
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

export function EventsMap({ cards, studentSpot }: { cards: MapCard[]; studentSpot: Point }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerClassRef = useRef<typeof Marker | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; element: HTMLElement }>>(new Map());
  const interacted = useRef(false);
  // True while the strip is moving because a bubble was tapped, so the scroll
  // that follows does not pick a different card on its way.
  const programmaticScroll = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [chip, setChip] = useState<MapChip>("forYou");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [lastDismissed, setLastDismissed] = useState<MapCard | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [crawlOpen, setCrawlOpen] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const routeMarkersRef = useRef<Marker[]>([]);

  const visibleCards = useMemo(
    () => cards.filter((card) => !dismissed.includes(card.eventId) && card.chips.includes(chip)),
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
        if (corner) corner.style.bottom = "calc(var(--tabbar-height) + var(--tabbar-gap) + 196px)";
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

  // Bubbles follow the visible cards.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClassRef.current;
    if (!mapReady || !map || !MarkerClass) return;

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
        programmaticScroll.current = true;
        // If the strip was already in place no scroll follows; never let the
        // flag swallow the next real swipe.
        setTimeout(() => (programmaticScroll.current = false), 400);
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

  // The crawl's route on the map: dotted line, numbered stops, the rest faded.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClassRef.current;
    if (!mapReady || !map || !MarkerClass) return;
    for (const marker of routeMarkersRef.current) marker.remove();
    routeMarkersRef.current = [];
    const stopIds = new Set(route?.stops.map((stop) => stop.eventId) ?? []);
    for (const [id, { element }] of markersRef.current) setMarkerFaded(element, route !== null && !stopIds.has(id), route !== null);
    const source = map.getSource(ROUTE_SOURCE) as { setData: (data: unknown) => void } | undefined;
    if (!route) {
      if (map.getLayer(ROUTE_SOURCE)) map.removeLayer(ROUTE_SOURCE);
      if (source) map.removeSource(ROUTE_SOURCE);
      return;
    }
    if (source) source.setData(routeLine(route));
    else {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: routeLine(route) });
      map.addLayer({
        id: ROUTE_SOURCE,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0866ff", "line-width": 4, "line-dasharray": [0.2, 2] },
      });
    }
    route.stops.forEach((stop, index) => {
      routeMarkersRef.current.push(
        new MarkerClass({ element: routeMarkerElement(String(index + 1), false) }).setLngLat([stop.lng, stop.lat]).addTo(map),
      );
    });
    const sameAsStart = route.destination.lat === route.from.lat && route.destination.lng === route.from.lng;
    if (!sameAsStart) {
      routeMarkersRef.current.push(
        new MarkerClass({ element: routeMarkerElement("", true) }).setLngLat([route.destination.lng, route.destination.lat]).addTo(map),
      );
    }
    const points = [route.from, ...route.stops, route.destination];
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 70, bottom: 420, left: 50, right: 50 }, maxZoom: 16.5, duration: 700 },
    );
  }, [mapReady, route]);

  const crawlEvents = useMemo(
    () => cards.map((card) => ({ eventId: card.eventId, title: card.title, place: card.place, startIso: card.startIso, endIso: card.endIso })),
    [cards],
  );

  const recenter = useCallback(() => {
    if (mapRef.current) frameStudent(mapRef.current, studentSpot, visibleCards, true);
  }, [studentSpot, visibleCards]);

  // Muse learns from Not for me (POST /api/muse/learn, kind "dismissed"), but
  // only once the Undo window has passed, since a dismissal cannot be unlearned.
  // Then the page refreshes so the picks reflect what Muse now knows.
  const learnTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = learnTimers.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const dismiss = useCallback(
    (card: MapCard) => {
      const next = [...dismissed, card.eventId];
      setDismissed(next);
      writeDismissed(next);
      setLastDismissed(card);
      const timer = setTimeout(() => {
        learnTimers.current.delete(card.eventId);
        setLastDismissed((current) => (current?.eventId === card.eventId ? null : current));
        void fetch("/api/muse/learn", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: card.eventId, kind: "dismissed" }),
        })
          .then((response) => {
            if (response.ok) router.refresh();
          })
          .catch(() => undefined);
      }, UNDO_MS);
      learnTimers.current.set(card.eventId, timer);
    },
    [dismissed, router],
  );

  const undoDismiss = useCallback(() => {
    if (!lastDismissed) return;
    const timer = learnTimers.current.get(lastDismissed.eventId);
    if (timer) clearTimeout(timer);
    learnTimers.current.delete(lastDismissed.eventId);
    const next = dismissed.filter((id) => id !== lastDismissed.eventId);
    setDismissed(next);
    writeDismissed(next);
    setLastDismissed(null);
  }, [dismissed, lastDismissed]);

  // When a swipe settles, the card in place becomes active. Cards the strip
  // passes on the way are ignored, so the map moves once, not per card.
  const onStripScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const strip = stripRef.current;
      if (!strip) return;
      if (programmaticScroll.current) {
        programmaticScroll.current = false;
        return;
      }
      const id = settledCardId(strip);
      if (id) setActiveId(id);
    }, 140);
  }, []);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // Fly to the active event once the student swipes or taps a bubble; the map
  // opens on the student, not on the first card.
  useEffect(() => {
    if (!activeId || !interacted.current) return;
    const card = visibleCards.find((item) => item.eventId === activeId);
    // One calm move: ease out over 700 ms instead of a quick snap.
    if (card) {
      mapRef.current?.easeTo({
        center: [card.place.lng, card.place.lat],
        duration: 700,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    }
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
        style={{ display: crawlOpen ? "none" : undefined }}
      >
        {CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={chip === item.id}
            onClick={() => {
              setChip(item.id);
              setLastDismissed(null);
              // A new filter starts at its first card, highlighted.
              setActiveId(null);
              programmaticScroll.current = true;
              setTimeout(() => (programmaticScroll.current = false), 400);
              stripRef.current?.scrollTo({ left: 0, behavior: "instant" });
            }}
            className={`shrink-0 rounded-full px-[12px] py-[6px] text-meta font-semibold shadow-sm ${
              chip === item.id ? "bg-ink text-white" : "bg-card text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>


      {!crawlOpen && (
        <button
          type="button"
          onClick={() => {
            setLastDismissed(null);
            setCrawlOpen(true);
          }}
          aria-label="Plan a food crawl"
          title="Food crawl"
          className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-md active:scale-95"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 196px)" }}
        >
          <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="2.2" />
            <circle cx="18" cy="5" r="2.2" />
            <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
          </svg>
        </button>
      )}

      {crawlOpen && (
        <CrawlPlanner
          studentSpot={studentSpot}
          events={crawlEvents}
          dismissed={dismissed}
          onRoute={setRoute}
          onClose={() => {
            setRoute(null);
            setCrawlOpen(false);
          }}
        />
      )}

      <button
        type="button"
        onClick={recenter}
        aria-label="Recenter on my location"
        className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-md active:scale-95"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 144px)", display: crawlOpen ? "none" : undefined }}
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
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 150px)" }}
        >
          <span className="max-w-[170px] truncate">Hidden: {lastDismissed.title}</span>
          <button type="button" onClick={undoDismiss} className="text-primary-soft underline">
            Undo
          </button>
        </div>
      )}

      {visibleCards.length === 0 && !crawlOpen && (
        <p
          className="absolute inset-x-3 z-10 rounded-[18px] bg-card px-3 py-3 text-center text-body text-muted shadow-md"
          style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 12px)" }}
        >
          {chip === "forYou"
            ? "Nothing picked for you right now. Try Free to see everything free nearby."
            : "Nothing free right now. New events show up here as clubs post them."}
        </p>
      )}

      <ol
        ref={stripRef}
        onScroll={onStripScroll}
        onPointerDown={() => {
          interacted.current = true;
          programmaticScroll.current = false;
        }}
        onWheel={() => {
          interacted.current = true;
          programmaticScroll.current = false;
        }}
        onKeyDown={() => (interacted.current = true)}
        aria-label="Events on the map"
        className="no-scrollbar absolute inset-x-0 z-10 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3 pb-1"
        style={{ bottom: "calc(var(--tabbar-height) + var(--tabbar-gap) + 10px)", display: crawlOpen ? "none" : undefined }}
      >
        {visibleCards.map((card) => (
          <li key={card.eventId} data-event-id={card.eventId} className="w-[320px] shrink-0 snap-start">
            <article
              className="relative flex h-[128px] items-center gap-[12px] rounded-[18px] bg-card p-[12px] pr-[30px] shadow-md"
            >
              <LogoTile card={card} />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-display text-label font-bold">
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
                {/* Every card is one size and tall enough for a two-line title, the
                    time, walk and Directions, and the place. Personalization reasons
                    stay inside the agent, as on the Top 3 and alerts (d-fwq6). */}
                <p className="mt-[4px] flex items-center gap-[5px] text-[12px] font-semibold leading-[15px] text-muted">
                  <MapPinIcon className="h-[12px] w-[12px] shrink-0" />
                  <span className="truncate">{card.place.name}</span>
                </p>
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
