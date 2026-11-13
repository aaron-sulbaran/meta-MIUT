import type { NextRequest } from "next/server";
import { openToPublic } from "@/lib/events/open";

// POST: the organizer said yes to "open it to everyone". The event becomes open
// (it shows under Free if it is free) and nearby students get an alert.
export async function POST(_request: NextRequest, context: RouteContext<"/api/events/[id]/open">) {
  const { id } = await context.params;
  const result = await openToPublic(id);
  if (result.error === "No event with that id") return Response.json(result, { status: 404 });
  return Response.json(result, { status: result.error === null ? 200 : 400 });
}
