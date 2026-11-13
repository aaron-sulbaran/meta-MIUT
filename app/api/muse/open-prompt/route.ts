import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { OpenPromptInputSchema, draftOpenPrompt } from "@/lib/muse/open-prompt";

// POST { eventId }: the one-tap question for the organizer and when to show it (askAt, 30 min before the end).
export async function POST(request: Request) {
  const body = await readJsonBody(request, OpenPromptInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });
  const result = await draftOpenPrompt(event);
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
