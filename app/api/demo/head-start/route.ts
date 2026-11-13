import { z } from "zod";
import { HEAD_START_HEADER } from "@/lib/demo/head-start";
import { legTimer } from "@/lib/demo/legs";
import { isStoryCaption } from "@/lib/demo/story-fixtures";
import { walkHomeRequest } from "@/lib/demo/walk-home";
import { readJsonBody } from "@/lib/http";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { getEventStore } from "@/lib/events/store";
import { ExtractInputSchema } from "@/lib/muse/extract";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { personalizeEvents } from "@/lib/muse/rank";
import { PERSONA_COOKIE } from "@/lib/social/persona";

// POST: the /demo stage asks one of the demo's slow live questions a few beats early
// (components/demo/head-start.ts), through the very route its screen will call, so the
// screen shares that call (lib/demo/head-start.ts). Waits for the live answer and says
// how it went; the stage does not read the answer itself.
//   { job: "flyer", input }  the story's flyer and caption, as the organizer screen sends them (O3)
//   { job: "walk-home", at } the walk home on the run's clock (U1b)
//   { job: "curate" }        Trish's first Events feed (U3b)
const HeadStartSchema = z.discriminatedUnion("job", [
  z.object({ job: z.literal("flyer"), input: ExtractInputSchema }),
  z.object({ job: z.literal("walk-home"), at: z.iso.datetime({ offset: true }) }),
  z.object({ job: z.literal("curate") }),
]);

export async function POST(request: Request) {
  const legs = legTimer("head-start");
  const body = await readJsonBody(request, HeadStartSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const job = body.data;
  if (job.job === "flyer" && !isStoryCaption(job.input.caption)) {
    return Response.json({ data: null, error: "Only the demo story's flyer gets a head start" }, { status: 400 });
  }
  const headers: Record<string, string> = { "content-type": "application/json", [HEAD_START_HEADER]: "1" };
  let path: string;
  let payload: unknown = null;
  if (job.job === "flyer") {
    path = "/api/muse/extract/events";
    payload = job.input;
  } else if (job.job === "walk-home") {
    path = "/api/muse/crawl";
    payload = walkHomeRequest(loadDemoStudent().home, job.at);
  } else {
    path = "/api/curate";
    headers.cookie = `${PERSONA_COOKIE}=user3`;
  }
  // The map under the walk home and Trish's first Events renders its Top 3 first (lib/muse/rank.ts,
  // shared across instances), and its Muse card only after that: warm it alongside.
  const picks = job.job === "flyer" ? Promise.resolve(null) : warmTopPicks().catch(() => null);
  try {
    const response = await fetch(new URL(path, request.url), {
      method: "POST",
      headers,
      ...(payload === null ? {} : { body: JSON.stringify(payload) }),
      cache: "no-store",
    });
    const answer = (await response.json()) as { source?: string; museMs?: number | null };
    await picks;
    legs.done({ job: job.job, status: response.status, source: answer.source, museMs: answer.museMs });
    return Response.json({ data: { job: job.job, source: answer.source ?? null, museMs: answer.museMs ?? null }, error: null });
  } catch (error) {
    legs.done({ job: job.job, failed: true });
    return Response.json({ data: null, error: error instanceof Error ? error.message : "Head start failed" }, { status: 502 });
  }
}

/** The Top 3 the map page asks for (components/map/map-home.tsx), the same inputs. */
async function warmTopPicks() {
  const now = new Date();
  const events = await getEventStore().listEvents();
  return personalizeEvents(loadDemoStudent(), events, now, await loadInterestMemory(DEMO_USER_ID, now));
}
