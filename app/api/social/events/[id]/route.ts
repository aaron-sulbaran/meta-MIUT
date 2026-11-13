import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { setGoing, whoIsGoing } from "@/lib/social/going";
import { demoViewer } from "@/lib/social/viewer";

// GET: who is going (friends, students open to company, others count).
// POST { going, open?, note? }: the demo viewer marks Going, optionally open to company.

const GoingUpdateSchema = z.object({
  going: z.boolean(),
  open: z.boolean().optional(),
  note: z.string().trim().max(120).optional(),
});

export async function GET(_request: NextRequest, context: RouteContext<"/api/social/events/[id]">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = demoViewer();
  return Response.json({ data: whoIsGoing(event, viewer.id, viewer.interests), error: null });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/social/events/[id]">) {
  const { id } = await context.params;
  const body = await readJsonBody(request, GoingUpdateSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = demoViewer();
  setGoing(event, viewer.id, body.data);
  return Response.json({ data: whoIsGoing(event, viewer.id, viewer.interests), error: null });
}
