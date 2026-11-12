import { z } from "zod";
import { readJsonBody } from "@/lib/http";
import { learnFromEvent } from "@/lib/muse/learn";
import { DEMO_USER_ID, EVENT_SIGNAL_KINDS } from "@/lib/muse/memory";

const LearnRequestSchema = z.object({
  userId: z.string().min(1).max(64).optional(),
  eventId: z.string().min(1),
  kind: z.enum(EVENT_SIGNAL_KINDS),
});

// POST { userId?, eventId, kind } teaches Muse from an event action
// (interested, rsvp, attended, dismissed) and returns the updated memory.
export async function POST(request: Request) {
  const body = await readJsonBody(request, LearnRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const result = await learnFromEvent({ ...body.data, userId: body.data.userId ?? DEMO_USER_ID });
  return Response.json(result, { status: result.error === null ? 200 : 404 });
}
