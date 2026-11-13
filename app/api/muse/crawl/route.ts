import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { CrawlInputSchema, planCrawl } from "@/lib/muse/crawl";

// POST { from, to, toLabel?, note? }: ordered free stops from class to home (or a friend),
// a one-line pitch, and an invite to share. Send a new `to` and `note` to re-plan for a friend.
export async function POST(request: Request) {
  const body = await readJsonBody(request, CrawlInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const events = await getEventStore().listEvents();
  const result = await planCrawl(body.data, events);
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
