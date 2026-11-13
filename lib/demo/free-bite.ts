import type { CampusEvent } from "@/lib/events/schema";
import { freePerk, isOpenFree } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";

// What the class-ended Live Activity offers (demo beat U1a): the closest free
// food that is on now or starting within 20 minutes and not about to end.
// Real data: the same events the map shows.

export type FreeBite = { eventId: string; title: string; placeName: string; perk: string; walkMinutes: number; endsAt: string; startsAt: string };

const MINUTE = 60_000;

export function nearestFreeBite(events: CampusEvent[], from: { lat: number; lng: number }, now: Date): FreeBite | null {
  const at = now.getTime();
  const open = events
    .filter((event) => event.status === "published" && event.food && isOpenFree(event))
    .filter((event) => Date.parse(event.start) <= at + 20 * MINUTE && Date.parse(event.end) > at + 15 * MINUTE)
    .map((event) => ({ event, walk: walkMinutes(from, event.place) }))
    .sort((a, b) => a.walk - b.walk || Date.parse(a.event.start) - Date.parse(b.event.start));
  const best = open[0];
  if (!best) return null;
  return {
    eventId: best.event.id,
    title: best.event.title,
    placeName: best.event.place.name,
    perk: freePerk(best.event) ?? best.event.foodNote ?? "Free food",
    walkMinutes: best.walk,
    startsAt: best.event.start,
    endsAt: best.event.end,
  };
}
