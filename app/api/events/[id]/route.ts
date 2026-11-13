import type { NextRequest } from "next/server";
import { z } from "zod";
import { AccessSchema } from "@/lib/events/schema";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";

// GET: one event. PATCH { updates }: change a listed event in place, for a repost
// Muse matched to it (POST /api/muse/match returns exactly these fields). The place
// keeps its coordinates; only its name changes.

const EventUpdatesSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    placeName: z.string().trim().min(1).max(200),
    free: z.boolean(),
    food: z.boolean(),
    foodNote: z.string().max(200),
    access: AccessSchema,
  })
  .partial()
  .strict();

const PatchBodySchema = z.object({ updates: EventUpdatesSchema });

export async function GET(_request: NextRequest, context: RouteContext<"/api/events/[id]">) {
  const { id } = await context.params;
  const event = await getEventStore().getEvent(id);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });
  return Response.json({ data: event, error: null });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/events/[id]">) {
  const { id } = await context.params;
  const body = await readJsonBody(request, PatchBodySchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });

  const store = getEventStore();
  const event = await store.getEvent(id);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });

  const { placeName, ...rest } = body.data.updates;
  const saved = await store.upsertEvent({
    ...event,
    ...rest,
    place: placeName ? { ...event.place, name: placeName } : event.place,
  });
  if (saved.error !== null) return Response.json(saved, { status: 400 });
  return Response.json(saved);
}
