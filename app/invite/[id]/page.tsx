import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InviteLanding } from "@/components/invite/invite-landing";
import { posterKicker } from "@/components/events/event-card";
import { Poster } from "@/components/ui/poster";
import { getEventStore } from "@/lib/events/store";
import { formatDateLine, formatEventTime, freePerk } from "@/lib/events/time";
import { EVERYONE, FRIENDS } from "@/lib/social/fixtures/people";
import { currentViewer } from "@/lib/social/viewer";

// Where an invite lands for someone with no Facebook account (Lisa in the demo,
// U2b and U2c): "Aaron invited you" under Meta's "Your Meta Account is here"
// sheet, one tap, then the event, "Aaron knows you're going", and what came
// over from Instagram (components/invite/invite-landing.tsx). The account is
// staged; marking Going is real. ?state=joined (U2c) opens on the joined state.
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; state?: string }>;
}) {
  await connection();
  const [{ id }, { from, state }] = await Promise.all([params, searchParams]);
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();

  const now = new Date();
  const viewer = await currentViewer();
  const inviter = EVERYONE.find((person) => person.id === from) ?? null;
  const viewerInstagram = EVERYONE.find((person) => person.id === viewer.id)?.instagram ?? null;
  // Her friends already on Facebook, the inviter first: who she knows there on day one.
  const friendIds = new Set([...(FRIENDS[viewer.id] ?? []), ...Object.entries(FRIENDS).filter(([, list]) => list.includes(viewer.id)).map(([id]) => id)]);
  const friendNames = [...friendIds]
    .sort((a, b) => Number(b === inviter?.id) - Number(a === inviter?.id))
    .flatMap((id) => EVERYONE.find((person) => person.id === id)?.name ?? [])
    .slice(0, 3);

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
      friendNames={friendNames}
      initialJoined={state === "joined"}
      poster={<Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />}
    />
  );
}
