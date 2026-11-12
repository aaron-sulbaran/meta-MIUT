import type { CampusEvent, RankedPick } from "@/lib/events/schema";
import { distanceMeters } from "@/lib/geo";

// Heat for the map: how strongly each event should glow for this student.
// Muse's picks lead (first pick hottest). Every other upcoming event still
// gets a faint glow from simple signals, so the map is never empty when Muse
// is offline. Pure, so the client and tests share it.

export type HeatPoint = {
  eventId: string;
  lat: number;
  lng: number;
  /** 0 to 1. */
  weight: number;
  /** 1, 2, or 3 for Muse's picks; null for the rest. */
  pickRank: number | null;
  reason: string | null;
};

type Point = { lat: number; lng: number };

const PICK_WEIGHTS = [1, 0.85, 0.72];
const ONE_MILE_METERS = 1609;
const MINUTE = 60_000;

function baseWeight(event: CampusEvent, origin: Point, now: Date): number {
  const nowMs = now.getTime();
  const happeningNow = Date.parse(event.start) <= nowMs && Date.parse(event.end) > nowMs;
  const startsSoon = !happeningNow && Date.parse(event.start) <= nowMs + 90 * MINUTE;
  const closeness = Math.max(0, 1 - distanceMeters(origin, event.place) / ONE_MILE_METERS);
  let weight = 0.12;
  if (event.free) weight += 0.1;
  if (event.food) weight += 0.08;
  if (happeningNow) weight += 0.1;
  else if (startsSoon) weight += 0.05;
  weight += 0.15 * closeness;
  return Math.min(weight, 0.6);
}

/** Heat points for events that have not ended, picks first, then by weight. */
export function heatPoints(events: CampusEvent[], picks: RankedPick[], origin: Point, now: Date): HeatPoint[] {
  const pickIndex = new Map(picks.map((pick, index) => [pick.eventId, { index, reason: pick.reason }]));
  return events
    .filter((event) => Date.parse(event.end) > now.getTime())
    .map((event) => {
      const pick = pickIndex.get(event.id);
      const weight = pick ? (PICK_WEIGHTS[pick.index] ?? 0.65) : baseWeight(event, origin, now);
      return {
        eventId: event.id,
        lat: event.place.lat,
        lng: event.place.lng,
        weight,
        pickRank: pick ? pick.index + 1 : null,
        reason: pick?.reason ?? null,
      };
    })
    .sort((a, b) => {
      if (a.pickRank !== null || b.pickRank !== null) return (a.pickRank ?? 99) - (b.pickRank ?? 99);
      return b.weight - a.weight;
    });
}
