import "server-only";
import type { CampusEvent } from "@/lib/events/schema";
import { getEventStore, type StoreResult } from "@/lib/events/store";
import { knownPlacesFrom, resolvePlace } from "@/lib/organizer/place";
import { STORY, STORY_FALLBACK_ID, STORY_ORGANIZER } from "@/lib/demo/story-data";
import { flyerUrl } from "@/lib/demo/staged";

// The one event the demo follows through all four people. The organizer makes
// it live in the first act (Muse reads the flyer); any later beat that needs it
// asks for it here. If the organizer act was skipped or the data was reset, the
// same event is listed quietly (no alert) so the next beat still has it.
// The event itself is plain data in story-data.ts, shared with the staged screens.

export { STORY, STORY_FALLBACK_ID, STORY_ORGANIZER } from "@/lib/demo/story-data";

const MINUTE_MS = 60_000;

/**
 * The flyer the organizer posted, for an event at `start`: the same drawn flyer
 * (app/demo/flyer.png) on the clock the post used, which put the start 25 minutes out.
 */
export function storyFlyerFor(start: Date): string {
  return flyerUrl(new Date(start.getTime() - STORY.startsInMinutes * MINUTE_MS));
}

/**
 * The story event with its flyer as its image, so every screen that shows an
 * event's flyer (source.imagePath) shows the one the organizer posted, never a
 * generated poster. Null when it already has one.
 */
export function withStoryFlyer(event: CampusEvent): CampusEvent | null {
  if (event.source.imagePath) return null;
  return { ...event, source: { ...event.source, imagePath: storyFlyerFor(new Date(event.start)) } };
}

const sameHandle = (event: CampusEvent) => event.organizer.handle.toLowerCase() === STORY_ORGANIZER.handle;

/** The run's story event (every story publish lands on its one id), else the newest from its organizer, or null. */
export function pickStoryEvent(events: CampusEvent[]): CampusEvent | null {
  const story = events.find((event) => event.id === STORY_FALLBACK_ID);
  if (story) return story;
  return events.filter(sameHandle).sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
}

export function storyFallbackEvent(events: CampusEvent[], now: Date): CampusEvent {
  const place = resolvePlace(STORY.placeName, knownPlacesFrom(events))?.place ?? {
    name: STORY.placeName,
    lat: 42.3624,
    lng: -71.0879,
  };
  const start = new Date(now.getTime() + STORY.startsInMinutes * MINUTE_MS);
  const end = new Date(start.getTime() + STORY.durationMinutes * MINUTE_MS);
  return {
    id: STORY_FALLBACK_ID,
    title: STORY.title,
    description: STORY.description,
    start: start.toISOString(),
    end: end.toISOString(),
    place,
    free: true,
    food: true,
    foodNote: STORY.foodNote,
    access: { kind: "open" },
    organizer: { ...STORY_ORGANIZER },
    source: { kind: "instagram", caption: `${STORY.title} at ${STORY.placeName}. ${STORY.description}`, imagePath: storyFlyerFor(start) },
    status: "published",
    createdAt: now.toISOString(),
  };
}

/**
 * The story event: the organizer's newest, else the quiet fallback, listed now if missing.
 * Either way it carries the posted flyer as its image (added once, if the organizer's
 * one tap post did not send it).
 */
export async function ensureStoryEvent(now = new Date()): Promise<StoreResult<CampusEvent>> {
  const store = getEventStore();
  const events = await store.listEvents();
  const existing = pickStoryEvent(events);
  if (existing) {
    const withFlyer = withStoryFlyer(existing);
    return withFlyer ? store.upsertEvent(withFlyer) : { data: existing, error: null };
  }
  return store.upsertEvent(storyFallbackEvent(events, now));
}
