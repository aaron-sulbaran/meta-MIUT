import "server-only";
import { composeAlert } from "@/lib/alerts/compose";
import { getAlertFeed, type AlertFeed } from "@/lib/alerts/feed";
import type { Alert } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedStudent } from "@/lib/events/seed";
import { getEventStore, type EventStore, type StoreResult } from "@/lib/events/store";

export type OpenOutcome = { event: CampusEvent; alert: Alert | null; alertError: string | null };

// The organizer's one tap near the end: a limited-spot event opens to everyone, so it
// joins the Free tab, and students are told there is food (or room) left.
export async function openToPublic(
  id: string,
  options: { now?: Date; store?: EventStore; feed?: AlertFeed; viewerLocation?: { lat: number; lng: number } } = {},
): Promise<StoreResult<OpenOutcome>> {
  const now = options.now ?? new Date();
  const store = options.store ?? getEventStore();
  const feed = options.feed ?? getAlertFeed();
  const event = await store.getEvent(id);
  if (!event) return { data: null, error: "No event with that id" };
  if (Date.parse(event.end) <= now.getTime()) return { data: null, error: "This event has already ended" };

  const saved = await store.upsertEvent({ ...event, access: { kind: "open" } });
  if (saved.error !== null) return saved;

  const kind = saved.data.food ? "leftover_food" : "new_event";
  const viewerLocation = options.viewerLocation ?? loadSeedStudent().home;
  const sent = await feed.publish(composeAlert(saved.data, kind, { now, viewerLocation }));
  return { data: { event: saved.data, alert: sent.data, alertError: sent.error }, error: null };
}
