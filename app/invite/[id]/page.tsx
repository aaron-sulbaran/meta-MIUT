import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InviteLanding } from "@/components/invite/invite-landing";
import { posterKicker } from "@/components/events/event-card";
import { Poster } from "@/components/ui/poster";
import { getEventStore } from "@/lib/events/store";
import { formatDateLine, formatEventTime, freePerk } from "@/lib/events/time";
import { EVERYONE } from "@/lib/social/fixtures/people";
import { currentViewer } from "@/lib/social/viewer";

// Where an invite lands for someone with no Facebook account (Lisa in the demo,
// U2b and U2c): "Aaron invited you", one tap to make an account with the Meta
// account they already use on Instagram, then the event and "Aaron knows you're
// going". The one-tap account is a mock; marking Going is real.
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await connection();
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();

  const now = new Date();
  const viewer = await currentViewer();
  const inviter = EVERYONE.find((person) => person.id === from) ?? null;
  const viewerInstagram = EVERYONE.find((person) => person.id === viewer.id)?.instagram ?? null;

  return (
    <InviteLanding
      eventId={event.id}
      eventTitle={event.title}
      organizerName={event.organizer.name}
      dateLine={formatDateLine(event, now)}
      timeLine={formatEventTime(event, now)}
      placeName={event.place.name}
      perk={freePerk(event)}
      inviterId={inviter?.id ?? null}
      inviterName={inviter?.name ?? null}
      viewerName={viewer.name}
      viewerInstagram={viewerInstagram}
      poster={<Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />}
    />
  );
}
