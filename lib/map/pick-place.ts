import { distanceMeters } from "@/lib/geo";

export type PlaceHit = { name: string; lat: number; lng: number; importance: number };

/**
 * The map search hit a crawl should end at. A named place beats a side street that shares its
 * name ("Harvard Square" the square, not the Charlestown lane), so only hits at least half as
 * notable as the top one compete. For a kind of place ("tacos") the hits are about equally
 * notable, so the closest wins.
 */
export function pickPlace(
  hits: PlaceHit[],
  near: { lat: number; lng: number },
): { hit: { name: string; lat: number; lng: number }; meters: number } | null {
  const top = Math.max(0, ...hits.map((hit) => hit.importance));
  const best = hits
    .filter((hit) => hit.importance >= top / 2)
    .map((hit) => ({ hit: { name: hit.name, lat: hit.lat, lng: hit.lng }, meters: distanceMeters(near, hit) }))
    .sort((a, b) => a.meters - b.meters)[0];
  return best ?? null;
}
