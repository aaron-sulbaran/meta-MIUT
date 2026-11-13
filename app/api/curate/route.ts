import { cachedCurate } from "@/lib/curate/cache";
import { curateFeed, curateFixtureFeed } from "@/lib/curate/curate";
import { shareAnswer, type SharedBody } from "@/lib/demo/head-start";
import { legTimer } from "@/lib/demo/legs";
import { ensureStoryEvent } from "@/lib/demo/story";
import { getEventStore } from "@/lib/events/store";
import { currentViewer } from "@/lib/social/viewer";

// POST: curate User 3's first events feed with Muse (lib/curate/curate.ts).
// Returns the picks with their full events, so the screen needs no second fetch.
// One answer per viewer for two minutes (lib/curate/cache.ts): the stage and the
// presenter's phone both ask, the first runs the live call, the second gets that answer.
// The stage starts it early for Trish's first Events map (beat U3b), with a time budget
// (lib/demo/head-start.ts): past it the screen gets the recorded feed.
export async function POST(request: Request) {
  const legs = legTimer("curate");
  const viewer = await currentViewer();
  const shared = await shareAnswer({
    key: `curate|${viewer.id}`,
    request,
    beatId: "U3b",
    run: () => cachedCurate(viewer.id, curateBody) as Promise<SharedBody>,
    recorded: () => curateBody() as Promise<SharedBody>,
  });
  const body = shared.body;
  legs.mark("answer");
  legs.done({ viewer: viewer.id, source: body.source, how: shared.how, museMs: body.museMs });
  const failed = (body as { data: unknown }).data === null;
  return Response.json(body, { status: failed ? 502 : 200 });
}

async function curateBody(): Promise<unknown> {
  const legs = legTimer("curate-run");
  const now = new Date();
  const story = await ensureStoryEvent(now);
  legs.mark("story");
  const events = await getEventStore().listEvents();
  legs.mark("store");
  // Anything thrown on the way still ends on the recorded feed (story first), never an error page.
  const result = await curateFeed(events, story.data?.id ?? null, now).catch((error: unknown) =>
    curateFixtureFeed(events, story.data?.id ?? null, now, error instanceof Error ? error.message : "Curate failed"),
  );
  legs.mark("muse");
  legs.done({ source: result.source });
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
