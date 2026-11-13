import { z } from "zod";
import { composeAlert } from "@/lib/alerts/compose";
import { getAlertFeed } from "@/lib/alerts/feed";
import { ALERT_KINDS, AlertHrefSchema } from "@/lib/alerts/schema";
import { loadSeedStudent } from "@/lib/events/seed";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";

const SinceSchema = z.coerce.number().int().min(0);

// GET ?since=<cursor>: alerts newer than the cursor, plus the next cursor.
// Without `since` it returns only the current cursor, so a screen that just
// opened does not replay old alerts.
export async function GET(request: Request) {
  const feed = getAlertFeed();
  const sinceParam = new URL(request.url).searchParams.get("since");

  if (sinceParam === null) {
    const latest = await feed.latestCursor();
    if (latest.error !== null) return Response.json({ data: null, error: latest.error }, { status: 502 });
    return Response.json({ data: { alerts: [], cursor: latest.data }, error: null });
  }

  const since = SinceSchema.safeParse(sinceParam);
  if (!since.success) return Response.json({ data: null, error: "since must be a whole number" }, { status: 400 });
  const page = await feed.listSince(since.data);
  if (page.error !== null) return Response.json({ data: null, error: page.error }, { status: 502 });
  return Response.json({ data: page.data, error: null });
}

const SendAlertSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(ALERT_KINDS),
  // Optional: only this viewer's phone shows it, and tapping opens this path
  // (for example the class-ended alert opening /?plan=home on the map).
  to: z.string().min(1).max(64).optional(),
  href: AlertHrefSchema.optional(),
});

// POST: send an alert for an existing event, for example the organizer's
// "push leftover food to people nearby" or a manual trigger from /demo.
export async function POST(request: Request) {
  const body = await readJsonBody(request, SendAlertSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });
  const composed = composeAlert(event, body.data.kind, { now: new Date(), viewerLocation: loadSeedStudent().home });
  const draft = {
    ...composed,
    ...(body.data.to ? { to: body.data.to } : {}),
    ...(body.data.href ? { href: body.data.href } : {}),
  };
  const sent = await getAlertFeed().publish(draft);
  return Response.json(sent, { status: sent.error === null ? 201 : 502 });
}
