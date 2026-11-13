import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppSwitch } from "@/components/demo/app-switch";
import { InviteLanding } from "@/components/invite/invite-landing";
import { inviteStep } from "@/components/invite/steps";
import { EventShareAction } from "@/components/events/event-actions";
import { posterKicker } from "@/components/events/event-card";
import { EventDetails, EventTitleBlock } from "@/components/events/event-details";
import { SubPageHeader } from "@/components/ui/header";
import { Poster } from "@/components/ui/poster";
import { getEventStore } from "@/lib/events/store";
import { EVERYONE, FRIENDS } from "@/lib/social/fixtures/people";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import { currentViewer } from "@/lib/social/viewer";

// Where an invite lands for someone with no Facebook account (Lisa's act, U2b to
// U2f): the event locked behind "you need a Facebook account", Meta's "Your Meta
// Account is here" sheet, the account ready, the event with I'm going, then going and
// Open to company (components/invite/invite-landing.tsx). ?state= opens on a step
// (account, ready, event, joined); ?opened=instagram plays the hop into Facebook.
// The account is staged; Going and Open to company are real.
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; state?: string; opened?: string }>;
}) {
  await connection();
  const [{ id }, { from, state, opened }] = await Promise.all([params, searchParams]);
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();

  const now = new Date();
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const inviter = EVERYONE.find((person) => person.id === from) ?? null;
  const viewerInstagram = EVERYONE.find((person) => person.id === viewer.id)?.instagram ?? null;
  // Her friends already on Facebook, the inviter first: who she knows there on day one.
  const friendIds = new Set([...(FRIENDS[viewer.id] ?? []), ...Object.entries(FRIENDS).filter(([, list]) => list.includes(viewer.id)).map(([id]) => id)]);
  const friendNames = [...friendIds]
    .sort((a, b) => Number(b === inviter?.id) - Number(a === inviter?.id))
    .flatMap((id) => EVERYONE.find((person) => person.id === id)?.name ?? [])
    .slice(0, 3);

  return (
    <AppSwitch from={opened}>
      <InviteLanding
        eventId={event.id}
        eventTitle={event.title}
        organizerName={event.organizer.name}
                inviterId={inviter?.id ?? null}
        inviterName={inviter?.name ?? null}
        viewerName={viewer.name}
        viewerInstagram={viewerInstagram}
        friendNames={friendNames}
        initialStep={inviteStep(state)}
        who={whoIsGoing(event, viewer.id, viewer.interests)}
      // The real event page's own parts, the same components /events/[id] draws.
      page={{
        header: <SubPageHeader title="Event" backHref="/" backLabel="Back to Events" actions={<EventShareAction event={event} />} />,
        title: <EventTitleBlock event={event} now={now} />,
        details: <EventDetails event={event} now={now} />,
      }}
      poster={<Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />}
      />
    </AppSwitch>
  );
}
