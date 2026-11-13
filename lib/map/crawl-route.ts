import { walkMinutes } from "@/lib/geo";
import { travel } from "@/lib/crawl/order";

// The map's side of the food crawl. Muse plans the route (POST /api/muse/crawl,
// lib/muse/crawl.ts, Trish); this keeps the plan editable on the map: re-time
// it after a stop is removed or added, place an added stop where it costs the
// least walking, and hand the whole route to Google Maps for directions.
// Re-timing uses the crawl's own travel times (lib/crawl/order.ts), so switching
// Walk and Transit re-times the same stops without asking Muse again.

export type Point = { lat: number; lng: number };
export type TravelMode = "walk" | "transit" | "drive";

/** One stop as the map shows it. `eventId` is null for a place the student named. */
export type RouteStop = {
  eventId: string | null;
  title: string;
  kind: string;
  placeName: string;
  lat: number;
  lng: number;
  /** When the event ends (ISO), to warn when a stop would be reached too late. */
  endsAt: string | null;
  /** When the event starts (ISO); arriving early means waiting until then. */
  startsAt: string | null;
  arriveAt: string;
  walkMinutes: number;
  mode: TravelMode;
};

export type RouteEnd = {
  name: string;
  lat: number;
  lng: number;
  arriveAt: string;
  walkMinutes: number;
  mode: TravelMode;
  /** What the walk ends at, for its map marker: a house for home, a person for a friend, else a pin. */
  kind?: "home" | "friend" | "place" | "wander";
};

export type Route = { from: Point; stops: RouteStop[]; destination: RouteEnd; totalWalkMinutes: number };

/** Minutes spent at each stop before walking on, as the crawl plans it. */
export const STOP_MINUTES = 15;
const MINUTE = 60_000;

/** Recompute every hop and arrival from the start time, by foot or with the T for long hops. */
export function retime(route: Route, startMs: number, mode: TravelMode = "walk"): Route {
  let here: Point = route.from;
  let at = startMs;
  let total = 0;
  const stops = route.stops.map((stop) => {
    const hop = travel(here, stop, mode);
    total += hop.minutes;
    const opens = stop.startsAt ? Date.parse(stop.startsAt) : Number.NEGATIVE_INFINITY;
    at = Math.max(at + hop.minutes * MINUTE, opens);
    const next = { ...stop, walkMinutes: hop.minutes, mode: hop.mode, arriveAt: new Date(at).toISOString() };
    at += STOP_MINUTES * MINUTE;
    here = stop;
    return next;
  });
  const last = travel(here, route.destination, mode);
  total += last.minutes;
  const destination = {
    ...route.destination,
    walkMinutes: last.minutes,
    mode: last.mode,
    arriveAt: new Date(at + last.minutes * MINUTE).toISOString(),
  };
  return { ...route, stops, destination, totalWalkMinutes: total };
}

/** Drop one stop and re-time the rest. */
export function removeStop(route: Route, index: number, startMs: number, mode: TravelMode = "walk"): Route {
  return retime({ ...route, stops: route.stops.filter((_, position) => position !== index) }, startMs, mode);
}

/** Put a new stop where it adds the least walking, then re-time. */
export function insertStop(route: Route, stop: RouteStop, startMs: number, mode: TravelMode = "walk"): Route {
  const points: Point[] = [route.from, ...route.stops, route.destination];
  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const cost = walkMinutes(a, stop) + walkMinutes(stop, b) - walkMinutes(a, b);
    if (cost < bestCost) {
      bestCost = cost;
      best = index;
    }
  }
  const stops = [...route.stops.slice(0, best), stop, ...route.stops.slice(best)];
  return retime({ ...route, stops }, startMs, mode);
}

/** True when the walk reaches the stop after (or within 10 minutes of) its end. */
export function arrivesTooLate(stop: RouteStop): boolean {
  if (!stop.endsAt) return false;
  return Date.parse(stop.arriveAt) > Date.parse(stop.endsAt) - 10 * MINUTE;
}

const GOOGLE_MODES: Record<TravelMode, string> = { walk: "walking", transit: "transit", drive: "driving" };

/** Google Maps directions through every stop in order (it allows several waypoints). */
export function googleDirectionsUrl(route: Route, mode: TravelMode = "walk"): string {
  const at = (point: Point) => `${point.lat},${point.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: at(route.from),
    destination: at(route.destination),
    travelmode: GOOGLE_MODES[mode],
  });
  if (route.stops.length > 0) params.set("waypoints", route.stops.map(at).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
