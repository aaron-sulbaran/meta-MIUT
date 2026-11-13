import type { NextRequest } from "next/server";
import { getEventStore } from "@/lib/events/store";
import { whoToGoWith } from "@/lib/social/muse-going";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import { currentViewer } from "@/lib/social/viewer";

// POST: Muse looks at who is going and says who this student could go with
// (friends first, then people with friends in common or shared interests).
export async function POST(_request: NextRequest, context: RouteContext<"/api/social/events/[id]/muse">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const who = whoIsGoing(event, viewer.id, viewer.interests);
  const result = await whoToGoWith(event, who, viewer.name);
  if (result.error !== null) return Response.json(result, { status: 502 });
  return Response.json({ ...result, data: { ...result.data, who } });
}
