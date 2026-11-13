import type { NextRequest } from "next/server";
import { shareAnswer, type SharedBody } from "@/lib/demo/head-start";
import { withoutMuse } from "@/lib/muse/client";
import { withStoryCompany } from "@/lib/demo/story-fixtures";
import { getEventStore } from "@/lib/events/store";
import { distinctReasons, whoToGoWith } from "@/lib/social/muse-going";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import { currentViewer } from "@/lib/social/viewer";
import { sharedAnswer } from "@/lib/store/shared-answer";

// POST: Muse looks at who is going and says who this student could go with
// (friends first, then people with friends in common or shared interests).
// One answer per viewer and event for two minutes (lib/store/shared-answer.ts): the
// stage and the presenter's phone both ask; the second gets the first's live answer.
// The going list itself is always fresh.
// The demo's ending (beat U3d) gets a head start from the stage and an 8 s budget to the recorded
// answer (lib/demo/head-start.ts), so the climax never waits on a slow Muse.
export async function POST(request: NextRequest, context: RouteContext<"/api/social/events/[id]/muse">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const who = whoIsGoing(event, viewer.id, viewer.interests);
  // ms is the real call's time, kept with the shared answer, so a second screen shows the same honest number.
  const ask = () =>
    sharedAnswer(`going:${viewer.id}:${event.id}`, async () => {
      const started = Date.now();
      const answer = await whoToGoWith(event, who, viewer.name);
      return { ...answer, ms: Date.now() - started };
    }) as Promise<SharedBody>;
  // Past the budget: the job's own recorded answer (Muse switched off for this request), no time.
  const recorded = async () => (await withoutMuse(`Muse did not answer within 8 s`, () => whoToGoWith(event, who, viewer.name))) as SharedBody;
  const shared = await shareAnswer({ key: `going|${viewer.id}|${event.id}`, request, beatId: "U3d", run: ask, recorded });
  const result = shared.body as unknown as Awaited<ReturnType<typeof whoToGoWith>> & { ms?: number };
  if (result.error !== null) return Response.json(result, { status: 502 });
  // The story's ending names exactly the people the page lists, even from a cached answer, each for their own reason.
  return Response.json({ ...result, data: { ...distinctReasons(withStoryCompany(result.data, event, who), who), who } });
}
