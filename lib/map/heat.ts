import type { CampusEvent, RankedPick } from "@/lib/events/schema";
import { distanceMeters } from "@/lib/geo";

// How much each event matters to this student, used to order the map's cards
// and size its bubbles. Muse's picks lead (first pick highest). Other events
// weigh by how likely the student is to care, from the interest-memory scores
// in personalizeEvents (lib/muse/rank.ts). Without those scores a simple
// fallback (free, food, now, close) still orders them. Pure, so the client and
// tests share it. (The map used to draw this as a heatmap; the weights stay.)

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

/** The parts of a LikelyEvent (lib/muse/types.ts) the heat needs. */
export type LikelyScore = { eventId: string; score: number; reason: string };

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

// A likely event glows between these, scaled by its score against the best one.
const LIKELY_MIN = 0.15;
const LIKELY_MAX = 0.6;
// Events the interest memory found nothing for.
const UNLIKELY_WEIGHT = 0.06;

/** Heat points for events that have not ended, picks first, then by weight. */
export function heatPoints(
  events: CampusEvent[],
  picks: RankedPick[],
  origin: Point,
  now: Date,
  likely?: LikelyScore[],
): HeatPoint[] {
  const pickIndex = new Map(picks.map((pick, index) => [pick.eventId, { index, reason: pick.reason }]));
  const likelyById = new Map((likely ?? []).map((item) => [item.eventId, item]));
  const topScore = Math.max(0, ...(likely ?? []).map((item) => item.score));

  const otherWeight = (event: CampusEvent): { weight: number; reason: string | null } => {
    if (!likely) return { weight: baseWeight(event, origin, now), reason: null };
    const item = likelyById.get(event.id);
    if (!item || item.score <= 0 || topScore <= 0) return { weight: UNLIKELY_WEIGHT, reason: item?.reason ?? null };
    return { weight: LIKELY_MIN + (LIKELY_MAX - LIKELY_MIN) * Math.min(1, item.score / topScore), reason: item.reason };
  };

  return events
    .filter((event) => Date.parse(event.end) > now.getTime())
    .map((event) => {
      const pick = pickIndex.get(event.id);
      const other = pick ? null : otherWeight(event);
      return {
        eventId: event.id,
        lat: event.place.lat,
        lng: event.place.lng,
        weight: pick ? (PICK_WEIGHTS[pick.index] ?? 0.65) : (other?.weight ?? UNLIKELY_WEIGHT),
        pickRank: pick ? pick.index + 1 : null,
        reason: pick?.reason ?? other?.reason ?? null,
      };
    })
    .sort((a, b) => {
      if (a.pickRank !== null || b.pickRank !== null) return (a.pickRank ?? 99) - (b.pickRank ?? 99);
      return b.weight - a.weight;
    });
}
