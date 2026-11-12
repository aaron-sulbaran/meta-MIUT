import { publishEvent, PublishEventInputSchema } from "@/lib/events/publish";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";

// GET: every event in the shared store. POST: publish a confirmed draft, which
// also sends the student an alert (see lib/alerts/policy.ts).
export async function GET() {
  const store = getEventStore();
  const events = await store.listEvents();
  return Response.json({ data: { events, backend: store.backend }, error: null });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, PublishEventInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  if (Date.parse(body.data.end) <= Date.parse(body.data.start)) {
    return Response.json({ data: null, error: "end must be after start" }, { status: 400 });
  }
  const result = await publishEvent(body.data);
  return Response.json(result, { status: result.error === null ? 201 : 502 });
}
