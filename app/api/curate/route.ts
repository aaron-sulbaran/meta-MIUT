import { curateFeed } from "@/lib/curate/curate";
import { ensureStoryEvent } from "@/lib/demo/story";
import { getEventStore } from "@/lib/events/store";

// POST: curate User 3's first events feed with Muse (lib/curate/curate.ts).
// Returns the picks with their full events, so the screen needs no second fetch.
export async function POST() {
  const now = new Date();
  const story = await ensureStoryEvent(now);
  const events = await getEventStore().listEvents();
  const result = await curateFeed(events, story.data?.id ?? null, now);
  if (result.data === null) return Response.json({ data: null, error: result.error, source: result.source }, { status: 502 });
  const byId = new Map(events.map((event) => [event.id, event]));
  const picks = result.data.picks.flatMap((pick) => {
    const event = byId.get(pick.eventId);
    return event ? [{ event, reason: pick.reason }] : [];
  });
  return Response.json({
    data: { summary: result.data.summary, picks, storyPinned: result.data.storyPinned },
    error: null,
    source: result.source,
    fallbackReason: result.fallbackReason,
  });
}
