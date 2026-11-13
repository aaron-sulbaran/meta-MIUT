import "server-only";
import type { CampusEvent } from "@/lib/events/schema";
import { getEventStore, type StoreResult } from "@/lib/events/store";
import { knownPlacesFrom, resolvePlace } from "@/lib/organizer/place";

// The one event the demo follows through all four people. The organizer makes
// it live in the first act (Muse reads the flyer); any later beat that needs it
// asks for it here. If the organizer act was skipped or the data was reset, the
// same event is listed quietly (no alert) so the next beat still has it.
// Its place sits between Aaron (Stata) and Lisa (Kendall Square), which is what
// "find one closer to both of us" lands on.

export const STORY_ORGANIZER = { name: "MIT Board Game Club", handle: "mit_boardgames" } as const;
export const STORY_FALLBACK_ID = "evt-demo-story";

const STORY = {
  title: "Board Game Night",
  description: "Drop in after class: free dumplings while they last, 40 board games, no experience needed. Open to everyone.",
  placeName: "MIT Museum, 314 Main St",
  startsInMinutes: 25,
  durationMinutes: 120,
  foodNote: "Dumplings",
};

const MINUTE_MS = 60_000;

const sameHandle = (event: CampusEvent) => event.organizer.handle.toLowerCase() === STORY_ORGANIZER.handle;

/** The newest listed event from the story's organizer, or null. */
export function pickStoryEvent(events: CampusEvent[]): CampusEvent | null {
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
    source: { kind: "instagram", caption: `${STORY.title} at ${STORY.placeName}. ${STORY.description}` },
    status: "published",
    createdAt: now.toISOString(),
  };
}

/** The story event: the organizer's newest, else the quiet fallback, listed now if missing. */
export async function ensureStoryEvent(now = new Date()): Promise<StoreResult<CampusEvent>> {
  const store = getEventStore();
  const events = await store.listEvents();
  const existing = pickStoryEvent(events);
  if (existing) return { data: existing, error: null };
  return store.upsertEvent(storyFallbackEvent(events, now));
}
