import { timingSafeEqual } from "node:crypto";
import { getAlertFeed } from "@/lib/alerts/feed";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore } from "@/lib/events/store";

// Puts the demo back to its starting state: fresh seed events with times
// relative to now, no stored alerts, and nobody interested or going. Open in
// development; in production it needs the DEMO_RESET_TOKEN env var and a
// matching `x-demo-token` header.
function isAllowed(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = process.env.DEMO_RESET_TOKEN?.trim();
  const given = request.headers.get("x-demo-token")?.trim();
  if (!expected || !given) return false;
  const expectedBytes = Buffer.from(expected);
  const givenBytes = Buffer.from(given);
  return expectedBytes.length === givenBytes.length && timingSafeEqual(expectedBytes, givenBytes);
}

export async function POST(request: Request) {
  if (!isAllowed(request)) {
    return Response.json({ data: null, error: "Reset needs the demo token" }, { status: 403 });
  }
  const reseeded = await getEventStore().resetToSeed(new Date());
  if (reseeded.error !== null) return Response.json({ data: null, error: reseeded.error }, { status: 502 });
  const cleared = await getAlertFeed().clear();
  if (cleared.error !== null) return Response.json({ data: null, error: cleared.error }, { status: 502 });
  const attendance = await getAttendanceStore().clearAll();
  if (attendance.error !== null) return Response.json({ data: null, error: attendance.error }, { status: 502 });
  return Response.json({ data: { events: reseeded.data }, error: null });
}
