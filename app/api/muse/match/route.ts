import { readJsonBody } from "@/lib/http";
import { getEventStore } from "@/lib/events/store";
import { MatchInputSchema, matchExistingEvent } from "@/lib/muse/match";

// Is this draft a repost of a listed event? Returns the matched id (or null) and only the fields to update.
export async function POST(request: Request) {
  const body = await readJsonBody(request, MatchInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const events = await getEventStore().listEvents();
  const result = await matchExistingEvent(body.data, events);
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
