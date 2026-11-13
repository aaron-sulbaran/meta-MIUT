import type { CampusEvent, Place } from "@/lib/events/schema";

// Muse reads a place name off the flyer ("Stata Center, 32-123"); publishing needs
// coordinates. This matches the name against places already on the map, which also
// keeps working when the seed moves to another campus. Client safe.

export type KnownPlace = Place;

// Words that say nothing about which building it is.
const FILLER = new Set(["the", "at", "of", "in", "on", "and", "a", "an", "room", "rm", "hall", "building", "bldg", "floor", "lobby", "center", "centre"]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalize(name)
    .split(" ")
    .filter((token) => token.length > 0 && !FILLER.has(token));
}

/** Every distinct place on listed events, first spelling wins. */
export function knownPlacesFrom(events: Pick<CampusEvent, "place">[]): KnownPlace[] {
  const byName = new Map<string, KnownPlace>();
  for (const { place } of events) {
    const key = normalize(place.name);
    if (key && !byName.has(key)) byName.set(key, { name: place.name, lat: place.lat, lng: place.lng });
  }
  return [...byName.values()].sort((first, second) => first.name.localeCompare(second.name));
}

// `place` keeps the organizer's wording with the known coordinates; `knownName` is the map's name for it.
export type PlaceMatch = { place: KnownPlace; exact: boolean; knownName: string };

const MIN_SHARED_FRACTION = 0.5;

/**
 * The known place a flyer's place name most likely means, or null. A match keeps the
 * organizer's wording as the name and borrows the known coordinates.
 */
export function resolvePlace(placeName: string, places: KnownPlace[]): PlaceMatch | null {
  const wanted = normalize(placeName);
  if (!wanted) return null;
  const exact = places.find((place) => normalize(place.name) === wanted);
  if (exact) return { place: { ...exact, name: placeName.trim() }, exact: true, knownName: exact.name };

  const wantedTokens = new Set(tokens(placeName));
  if (wantedTokens.size === 0) return null;
  let best: { place: KnownPlace; score: number } | null = null;
  for (const place of places) {
    const placeTokens = new Set(tokens(place.name));
    if (placeTokens.size === 0) continue;
    let shared = 0;
    for (const token of wantedTokens) if (placeTokens.has(token)) shared += 1;
    const score = shared / Math.min(wantedTokens.size, placeTokens.size);
    if (shared > 0 && score >= MIN_SHARED_FRACTION && (!best || score > best.score)) best = { place, score };
  }
  return best ? { place: { ...best.place, name: placeName.trim() }, exact: false, knownName: best.place.name } : null;
}

/** The middle of the known places, for a pin when the organizer picks "somewhere on campus". */
export function campusCenter(places: KnownPlace[]): { lat: number; lng: number } | null {
  if (places.length === 0) return null;
  const lat = places.reduce((sum, place) => sum + place.lat, 0) / places.length;
  const lng = places.reduce((sum, place) => sum + place.lng, 0) / places.length;
  return { lat, lng };
}
