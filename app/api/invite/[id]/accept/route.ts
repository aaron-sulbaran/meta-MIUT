import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { PERSONAS } from "@/lib/social/fixtures/people";
import { loadSocial, saveSocial, setGoing } from "@/lib/social/going";
import { currentViewer } from "@/lib/social/viewer";

// POST { from }: this phone's viewer accepts an invite. Both people are marked
// Going: whoever invited is going by inviting, so "Aaron knows you're going"
// and, later, "Aaron and Lisa are going" are both true.

const AcceptSchema = z.object({ from: z.string().min(1).max(64).optional() });

export async function POST(request: NextRequest, context: RouteContext<"/api/invite/[id]/accept">) {
  const { id } = await context.params;
  const body = await readJsonBody(request, AcceptSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });

  const viewer = await currentViewer();
  const inviter = PERSONAS.find((person) => person.id === body.data.from && person.id !== viewer.id) ?? null;
  await loadSocial([event.id]);
  setGoing(event, viewer.id, { going: true });
  if (inviter) setGoing(event, inviter.id, { going: true });
  await saveSocial(event);
  return Response.json({ data: { going: [viewer.id, ...(inviter ? [inviter.id] : [])] }, error: null });
}
