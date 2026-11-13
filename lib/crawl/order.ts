import type { CampusEvent } from "@/lib/events/schema";
import { distanceMeters, walkMinutes } from "@/lib/geo";

// How the food crawl times a route: travel between points and the best order through stops.
// No server-only, so the map can re-time a route on the client when a stop is added or removed.

export const STOP_KINDS = ["main", "dessert", "drinks", "snack", "merch", "event"] as const;
export const TRAVEL_MODES = ["walk", "transit", "drive"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type CrawlMode = TravelMode | "auto";
// Rough door-to-door speeds, not live schedules: the T or a bus with the walk to the stop and
// the wait, and a city drive with parking.
const AUTO_WALK_LIMIT_MINUTES = 20;
const TRANSIT_METERS_PER_MINUTE = 250;
const TRANSIT_OVERHEAD_MINUTES = 10;
const DRIVE_METERS_PER_MINUTE = 300;
const DRIVE_OVERHEAD_MINUTES = 8;
const STOP_MINUTES = 15;
const PREFERRED_ORDER_SLACK_MINUTES = 5;
export const MINUTE = 60_000;

export type CrawlStopKind = (typeof STOP_KINDS)[number];

export type CrawlStop = {
  // null for a place the student said they are going (kind "plan").
  eventId: string | null;
  title: string;
  kind: CrawlStopKind | "plan";
  placeName: string;
  lat: number;
  lng: number;
  arriveAt: string;
  // Minutes to get here from the previous point, and how.
  walkMinutes: number;
  mode: TravelMode;
};

export type Point = { lat: number; lng: number };
export type Pick = { event: CampusEvent; kind: CrawlStopKind };

// Minutes from one point to the next. Short hops are walked whatever the mode.
export function travel(from: Point, to: Point, mode: CrawlMode = "walk"): { mode: TravelMode; minutes: number } {
  const walk = walkMinutes(from, to);
  const meters = distanceMeters(from, to);
  const transit = Math.round(meters / TRANSIT_METERS_PER_MINUTE) + TRANSIT_OVERHEAD_MINUTES;
  const drive = Math.round(meters / DRIVE_METERS_PER_MINUTE) + DRIVE_OVERHEAD_MINUTES;
  if (mode === "drive" && drive < walk) return { mode: "drive", minutes: drive };
  if ((mode === "transit" || (mode === "auto" && walk > AUTO_WALK_LIMIT_MINUTES)) && transit < walk) {
    return { mode: "transit", minutes: transit };
  }
  return { mode: "walk", minutes: walk };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

export function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}

// The shortest walk from one point to the next that reaches each stop while it is still on
// (and the end by the deadline, if any). Stops that cannot fit are dropped, most kept first.
export function orderLeg(
  from: Point,
  to: Point,
  picks: Pick[],
  startMs: number,
  deadlineMs: number | null = null,
  mode: CrawlMode = "walk",
): { stops: CrawlStop[]; walkMinutes: number; arriveMs: number; lastMode: TravelMode } {
  for (let size = picks.length; size >= 0; size--) {
    type Route = { stops: CrawlStop[]; walk: number; arrive: number; lastMode: TravelMode };
    let best: Route | null = null;
    let given: Route | null = null;
    for (const subset of combinations(picks, size)) {
      for (const [index, order] of permutations(subset).entries()) {
        let at = startMs;
        let here: Point = from;
        let walk = 0;
        const stops: CrawlStop[] = [];
        let ok = true;
        for (const { event, kind } of order) {
          const step = travel(here, event.place, mode);
          const minutes = step.minutes;
          walk += minutes;
          at = Math.max(at + minutes * MINUTE, Date.parse(event.start));
          if (at > Date.parse(event.end) - 5 * MINUTE) {
            ok = false;
            break;
          }
          stops.push({ eventId: event.id, title: event.title, kind, placeName: event.place.name, lat: event.place.lat, lng: event.place.lng, arriveAt: new Date(at).toISOString(), walkMinutes: minutes, mode: step.mode });
          at += STOP_MINUTES * MINUTE;
          here = event.place;
        }
        const end = travel(here, to, mode);
        const last = end.minutes;
        const arrive = at + last * MINUTE;
        if (!ok || (deadlineMs !== null && size > 0 && arrive > deadlineMs)) continue;
        if (size === picks.length && index === 0) given = { stops, walk: walk + last, arrive, lastMode: end.mode };
        if (!best || walk + last < best.walk) best = { stops, walk: walk + last, arrive, lastMode: end.mode };
      }
    }
    // Keep Muse's order (the pitch names stops in it) unless another is clearly shorter.
    if (given && best && given.walk <= best.walk + PREFERRED_ORDER_SLACK_MINUTES) best = given;
    if (best) return { stops: best.stops, walkMinutes: best.walk, arriveMs: best.arrive, lastMode: best.lastMode };
  }
  const direct = travel(from, to, mode);
  return { stops: [], walkMinutes: direct.minutes, arriveMs: startMs + direct.minutes * MINUTE, lastMode: direct.mode };
}
