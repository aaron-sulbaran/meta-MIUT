import "server-only";
import type { CampusEvent } from "@/lib/events/schema";
import { getEventStore, type EventStore, type StoreResult } from "@/lib/events/store";
import { eventTopics } from "@/lib/muse/candidates";
import { saveSignals, type EventSignalKind, type InstagramSignal, type InterestMemory } from "@/lib/muse/memory";

// Muse keeps learning from what a student does about real events: marking one
// interested, RSVPing, going, or dismissing it with Not for me. Each action
// becomes a memory signal on the event's topics and organizer.

export function eventSignal(event: CampusEvent, kind: EventSignalKind, now = new Date()): InstagramSignal {
  // Dismissing one free-food event is about the event, not about free food.
  const topics = eventTopics(event).filter((topic) => kind !== "dismissed" || topic !== "free food");
  return {
    kind,
    at: now.toISOString(),
    topics: [...new Set(topics)].slice(0, 5),
    creator: event.organizer.handle,
    eventId: event.id,
  };
}

export async function learnFromEvent(
  action: { userId: string; eventId: string; kind: EventSignalKind; now?: Date },
  options: { store?: EventStore } = {},
): Promise<StoreResult<InterestMemory>> {
  const event = await (options.store ?? getEventStore()).getEvent(action.eventId);
  if (!event) return { data: null, error: "Event not found" };
  const now = action.now ?? new Date();
  return { data: await saveSignals(action.userId, [eventSignal(event, action.kind, now)], now), error: null };
}
