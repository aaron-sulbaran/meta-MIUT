import { z } from "zod";
import { getAlertFeed } from "@/lib/alerts/feed";
import { getEventStore } from "@/lib/events/store";
import { formatDateLine } from "@/lib/events/time";
import { readJsonBody } from "@/lib/http";
import { EVERYONE, FRIENDS } from "@/lib/social/fixtures/people";
import { currentViewer } from "@/lib/social/viewer";

// POST { to, eventId, message? }: this phone's viewer invites a friend to an
// event (Muse drafts the message on the map). The invite reaches the friend's
// phone as an in-app alert addressed to them ("Aaron invited you"), which
// opens the event with ?invite=<who invited>, for the landing that follows.

const InviteSchema = z.object({
  to: z.string().min(1).max(64),
  eventId: z.string().min(1),
  message: z.string().trim().min(1).max(400).optional(),
});

export async function POST(request: Request) {
  const body = await readJsonBody(request, InviteSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const viewer = await currentViewer();
  const friend = EVERYONE.find((person) => person.id === body.data.to);
  if (!friend || !(FRIENDS[viewer.id] ?? []).includes(friend.id)) {
    return Response.json({ data: null, error: "You can invite your friends only" }, { status: 400 });
  }
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "No event with that id" }, { status: 404 });

  const message = body.data.message ?? `${event.title}, ${formatDateLine(event, new Date())}. Want to come?`;
  const sent = await getAlertFeed().publish({
    kind: "new_event",
    eventId: event.id,
    title: `${viewer.name} invited you`.slice(0, 120),
    body: message.length > 240 ? `${message.slice(0, 237).trimEnd()}...` : message,
    to: friend.id,
    href: `/events/${encodeURIComponent(event.id)}?invite=${encodeURIComponent(viewer.id)}`,
  });
  if (sent.error !== null) return Response.json({ data: null, error: sent.error }, { status: 502 });
  return Response.json({ data: { to: friend.name, eventId: event.id, alertId: sent.data.id }, error: null }, { status: 201 });
}
