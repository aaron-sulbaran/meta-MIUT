import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { sayHello, whoIsGoing } from "@/lib/social/going";
import { demoViewer } from "@/lib/social/viewer";

// POST { eventId, to }: say hi to a student going who is open to company.
const HelloSchema = z.object({ eventId: z.string().min(1), to: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const body = await readJsonBody(request, HelloSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = demoViewer();
  const result = sayHello(event, viewer.id, body.data.to);
  if (result.error !== null) return Response.json({ data: null, error: result.error }, { status: 409 });
  return Response.json({ data: whoIsGoing(event, viewer.id, viewer.interests), error: null });
}
