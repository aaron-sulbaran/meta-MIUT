import type { AlertKind } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";

// Which alert, if any, a newly published event sends to the student.
// Placeholder rule so the delivery path works end to end: free food alerts as
// "free food nearby", everything else as a plain "new event".
// The real targeting rule (free now, within a mile, follows the club) is
// Jing's item t-f2aj and replaces this function; keep the signature.
export function alertKindForPublishedEvent(event: CampusEvent): AlertKind | null {
  if (event.status !== "published") return null;
  return event.free && event.food ? "free_food_nearby" : "new_event";
}
