import type { AlertKind } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";
import { distanceMeters } from "@/lib/geo";
import { compileCandidates } from "@/lib/muse/candidates";
import type { InterestMemory } from "@/lib/muse/memory";
import type { LikelyEvent } from "@/lib/muse/types";
import type { StudentContext } from "@/lib/muse/profile";

// Which alert, if any, a newly published event sends to the student.
// Free food alerts as "free food nearby", everything else as a plain "new event".
// Keep the signature: publishEvent and POST /api/alerts call it.
export function alertKindForPublishedEvent(event: CampusEvent): AlertKind | null {
  if (event.status !== "published") return null;
  return event.free && event.food ? "free_food_nearby" : "new_event";
}

export const NEARBY_METERS = 1_609; // one mile
export const NEARBY_LEAD_MINUTES = 60;

export type NearbyViewer = {
  profile: StudentContext;
  memory: InterestMemory;
  location: { lat: number; lng: number };
  now: Date;
};

export type NearbyMatch = { kind: AlertKind; candidate: LikelyEvent; meters: number };

// Who gets told when they walk near an event: it is on now or starts within
// the hour, it is within a mile of where they are, it does not clash with a
// class, and their interest memory, stated interests, or follows say they
// would likely care.
export function nearbyAlertFor(event: CampusEvent, viewer: NearbyViewer): NearbyMatch | null {
  if (event.status !== "published") return null;
  const nowMs = viewer.now.getTime();
  if (nowMs >= Date.parse(event.end)) return null;
  if (Date.parse(event.start) - nowMs > NEARBY_LEAD_MINUTES * 60_000) return null;

  const meters = distanceMeters(viewer.location, event.place);
  if (meters > NEARBY_METERS) return null;

  const [candidate] = compileCandidates({ ...viewer.profile, location: viewer.location }, viewer.memory, [event], viewer.now);
  if (!candidate || candidate.clash) return null;

  return { kind: event.free && event.food ? "free_food_nearby" : "new_event", candidate, meters };
}
