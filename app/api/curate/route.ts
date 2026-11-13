import { cachedCurate } from "@/lib/curate/cache";
import { curateFeed, curateFixtureFeed } from "@/lib/curate/curate";
import { ensureStoryEvent } from "@/lib/demo/story";
import { getEventStore } from "@/lib/events/store";
import { currentViewer } from "@/lib/social/viewer";

// POST: curate User 3's first events feed with Muse (lib/curate/curate.ts).
// Returns the picks with their full events, so the screen needs no second fetch.
// One answer per viewer for two minutes (lib/curate/cache.ts): the stage and the
// presenter's phone both ask, the first runs the live call, the second gets that answer.
export async function POST() {
  const viewer = await currentViewer();
  const body = await cachedCurate(viewer.id, curateBody);
  const failed = (body as { data: unknown }).data === null;
  return Response.json(body, { status: failed ? 502 : 200 });
}

async function curateBody(): Promise<unknown> {
  const now = new Date();
  const story = await ensureStoryEvent(now);
  const events = await getEventStore().listEvents();
  // Anything thrown on the way still ends on the recorded feed (story first), never an error page.
  const result = await curateFeed(events, story.data?.id ?? null, now).catch((error: unknown) =>
    curateFixtureFeed(events, story.data?.id ?? null, now, error instanceof Error ? error.message : "Curate failed"),
  );
  if (result.data === null) return { data: null, error: result.error, source: result.source };
  const byId = new Map(events.map((event) => [event.id, event]));
  const picks = result.data.picks.flatMap((pick) => {
    const event = byId.get(pick.eventId);
    return event ? [{ event, reason: pick.reason }] : [];
  });
  return {
    data: { summary: result.data.summary, picks, storyPinned: result.data.storyPinned },
    error: null,
    source: result.source,
    fallbackReason: result.fallbackReason,
  };
}
