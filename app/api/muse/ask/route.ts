import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { AskInputSchema, askAboutEvents } from "@/lib/muse/ask";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";

export async function POST(request: Request) {
  const body = await readJsonBody(request, AskInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const events = await getEventStore().listEvents();
  const result = await askAboutEvents(body.data, events, new Date(), loadDemoStudent());
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
