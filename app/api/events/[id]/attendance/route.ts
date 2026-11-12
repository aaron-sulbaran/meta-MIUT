import type { NextRequest } from "next/server";
import { EVENT_FULL_ERROR, AttendanceUpdateSchema, ViewerIdSchema } from "@/lib/attendance/schema";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";

// GET ?viewer=<id>: counts, seats left, and that viewer's own state.
// POST { viewerId, action }: interested, not_interested, rsvp, cancel_rsvp.
// RSVP on a full event answers 409 with the current summary.

export async function GET(request: NextRequest, context: RouteContext<"/api/events/[id]/attendance">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });

  const viewerParam = request.nextUrl.searchParams.get("viewer");
  const viewer = viewerParam === null ? null : ViewerIdSchema.safeParse(viewerParam);
  if (viewer && !viewer.success) return Response.json({ data: null, error: "Invalid viewer id" }, { status: 400 });

  const summary = await getAttendanceStore().summary(event, viewer?.data ?? null);
  if (summary.error !== null) return Response.json(summary, { status: 502 });
  return Response.json(summary);
}

export async function POST(request: NextRequest, context: RouteContext<"/api/events/[id]/attendance">) {
  const { id } = await context.params;
  const body = await readJsonBody(request, AttendanceUpdateSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });

  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });

  const store = getAttendanceStore();
  const result = await store.apply(event, body.data.viewerId, body.data.action);
  if (result.error === EVENT_FULL_ERROR) {
    const current = await store.summary(event, body.data.viewerId);
    return Response.json({ data: current.data, error: EVENT_FULL_ERROR }, { status: 409 });
  }
  if (result.error !== null) return Response.json(result, { status: 502 });
  return Response.json(result);
}
