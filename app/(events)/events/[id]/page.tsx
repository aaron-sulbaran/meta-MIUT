import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventShareAction } from "@/components/events/event-actions";
import { EventDetails } from "@/components/events/event-details";
import { EventCommentsSection } from "@/components/social/event-comments";
import { WhosGoing } from "@/components/social/whos-going";
import { posterKicker } from "@/components/events/event-card";
import { SubPageHeader } from "@/components/ui/header";
import { Poster } from "@/components/ui/poster";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore } from "@/lib/events/store";
import { formatDateLine } from "@/lib/events/time";
import { eventComments, loadComments } from "@/lib/social/comments";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import { currentViewer } from "@/lib/social/viewer";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; auto?: string; hi?: string; yes?: string }>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const fromAsk = query.from === "ask";
  // ?auto=1 (the demo's U3d): Muse is asked who to go with as the page opens.
  const autoAsk = query.auto === "1";
  // ?hi=1 (the demo's U3e): say hi to the people Muse suggests, unless this person already did.
  const autoSayHi = query.hi === "1";
  // ?yes=1 (the demo's U3f): once the hi is sent, Jolyn and Lisa say yes (a laptop-only run).
  const autoSayYes = query.yes === "1";
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();
  const now = new Date();
  const viewer = await currentViewer();
  await Promise.all([loadSocial([event.id]), loadComments(event.id)]);
  const who = whoIsGoing(event, viewer.id, viewer.interests);
  const rsvp = event.access.kind === "rsvp";
  // Seats left on an RSVP event with a limit, from the attendance store (t-vp0w).
  const attendance = rsvp ? await getAttendanceStore().summary(event, null) : null;
  const seats =
    attendance?.data && attendance.data.capacity !== null
      ? { capacity: attendance.data.capacity, left: attendance.data.seatsLeft ?? 0 }
      : null;

  return (
    <>
      <SubPageHeader
        title="Event"
        backHref={fromAsk ? "/ask" : "/"}
        backLabel={fromAsk ? "Back to Ask Muse" : "Back to Events"}
        actions={<EventShareAction event={event} />}
      />
      <Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />

      <section className="px-3 pt-[14px]">
        <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
        <h1 className="mt-[3px] font-display text-[22px] leading-[26px] font-bold">{event.title}</h1>
        <p className="mt-[4px] text-venue font-semibold text-ink">
          {event.place.name} · Hosted by {event.organizer.name}
        </p>
      </section>

      {/* One going button under the title, like Facebook's action row (RSVP on
          RSVP events; no Interested, lisa), then Who's going. */}
      <WhosGoing initial={who} rsvp={rsvp} seats={seats} autoAsk={autoAsk} autoSayHi={autoSayHi} autoSayYes={autoSayYes} />

      <Divider />

      <EventDetails event={event} now={now} />

      <Divider />

      <EventCommentsSection initial={eventComments(event, viewer.id, now)} />
    </>
  );
}

function Divider() {
  return <div aria-hidden className="my-[18px] h-px bg-hairline" />;
}
