import { legTimer } from "@/lib/demo/legs";
import { shareAnswer, walkHomeKey } from "@/lib/demo/head-start";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { CrawlInputSchema, planCrawl, type CrawlInput } from "@/lib/muse/crawl";

// POST { from, to, toLabel?, note?, at? }: ordered free stops from class to home (or a friend),
// a one-line pitch, and an invite to share. Send a new `to` and `note` to re-plan for a friend.
// The demo's walk home (beat U1b) is one shared answer per run, started early by the stage,
// with a time budget (lib/demo/head-start.ts).
export async function POST(request: Request) {
  const legs = legTimer("crawl");
  const body = await readJsonBody(request, CrawlInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const input = body.data;
  const key = walkHomeKey(input);
  const shared = key ? await shareAnswer({ key, request, beatId: "U1b", run: () => plan(input), recorded: () => plan(input) }) : null;
  const result = shared?.body ?? (await plan(input));
  legs.mark("answer");
  legs.done({ source: result.source, how: shared?.how ?? "own", museMs: shared?.body.museMs, note: Boolean(input.note) });
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}

async function plan(input: CrawlInput) {
  const events = await getEventStore().listEvents();
  return planCrawl(input, events, input.at ? new Date(input.at) : new Date());
}
