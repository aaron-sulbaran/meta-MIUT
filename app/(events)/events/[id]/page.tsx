import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ComponentType, ReactNode } from "react";
import { EventActions } from "@/components/events/event-actions";
import { WhosGoing } from "@/components/social/whos-going";
import { posterKicker } from "@/components/events/event-card";
import { SubPageHeader } from "@/components/ui/header";
import { ClockIcon, FoodIcon, InstagramPostIcon, MapPinIcon, PeopleIcon, TicketIcon } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { getEventStore } from "@/lib/events/store";
import { formatDateLine, formatEventTime } from "@/lib/events/time";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import { demoViewer } from "@/lib/social/viewer";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();
  const now = new Date();
  const viewer = demoViewer();
  await loadSocial([event.id]);

  return (
    <>
      <SubPageHeader title="Event" backHref="/" backLabel="Back to Events" />
      <Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />

      <section className="px-3 pt-[14px]">
        <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
        <h1 className="mt-[3px] font-display text-[22px] leading-[26px] font-bold">{event.title}</h1>
        <p className="mt-[4px] text-venue font-semibold text-ink">
          {event.place.name} · Hosted by {event.organizer.name}
        </p>
        <div className="mt-[12px]">
          <EventActions event={event} />
        </div>
      </section>

      <Divider />

      <WhosGoing initial={whoIsGoing(event, viewer.id, viewer.interests)} />

      <Divider />

      <section aria-labelledby="details-heading" className="px-3">
        <h2 id="details-heading" className="font-display text-title font-bold">
          Details
        </h2>
        <ul className="mt-[10px] flex flex-col gap-[12px]">
          <DetailRow Icon={ClockIcon}>{formatEventTime(event, now)}</DetailRow>
          <DetailRow Icon={MapPinIcon}>{event.place.name}</DetailRow>
          <DetailRow Icon={TicketIcon}>
            {event.free ? "Free" : "Paid entry"}
            {event.access.kind === "rsvp"
              ? event.access.capacity
                ? `, RSVP required, ${event.access.capacity} spots`
                : ", RSVP required"
              : ", open to everyone"}
          </DetailRow>
          {event.food && <DetailRow Icon={FoodIcon}>{event.foodNote ?? "Food provided"}</DetailRow>}
          <DetailRow Icon={PeopleIcon}>Hosted by {event.organizer.name}</DetailRow>
        </ul>
        {event.description && <p className="mt-[14px] text-body">{event.description}</p>}
      </section>

      <Divider />

      <section aria-labelledby="source-heading" className="px-3">
        <h2 id="source-heading" className="font-display text-title font-bold">
          Where this came from
        </h2>
        {event.source.kind === "instagram" ? (
          <div className="mt-[10px] rounded-card border border-hairline p-3">
            <p className="flex items-center gap-[7px] font-display text-label font-bold">
              <InstagramPostIcon className="h-[17px] w-[17px] shrink-0" />@{event.organizer.handle} on Instagram
            </p>
            {event.source.caption && <p className="mt-[6px] text-body">{event.source.caption}</p>}
          </div>
        ) : (
          <p className="mt-[8px] text-body text-muted">Added by hand by the organizer.</p>
        )}
      </section>
    </>
  );
}

function Divider() {
  return <div aria-hidden className="my-[18px] h-px bg-hairline" />;
}

function DetailRow({ Icon, children }: { Icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <li className="flex items-start gap-[12px] text-body font-medium">
      <Icon className="mt-[-1px] h-[20px] w-[20px] shrink-0 text-muted" />
      <span>{children}</span>
    </li>
  );
}
