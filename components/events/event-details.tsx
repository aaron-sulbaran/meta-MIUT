import type { ComponentType, ReactNode } from "react";
import { ClockIcon, FoodIcon, MapPinIcon, PeopleIcon, TicketIcon } from "@/components/ui/icons";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, formatEventTime } from "@/lib/events/time";

// The event page's title block: when, what, where and who hosts.
export function EventTitleBlock({ event, now }: { event: CampusEvent; now: Date }) {
  return (
    <section className="px-3 pt-[14px]">
      <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
      <h1 className="mt-[3px] font-display text-[22px] leading-[26px] font-bold">{event.title}</h1>
      <p className="mt-[4px] text-venue font-semibold text-ink">
        {event.place.name} · Hosted by {event.organizer.name}
      </p>
    </section>
  );
}

// The event page's Details section: time, place, entry, food, host, then the
// description. Also under an invite's event once it is unlocked (app/invite).
export function EventDetails({ event, now }: { event: CampusEvent; now: Date }) {
  return (
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
  );
}

function DetailRow({ Icon, children }: { Icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <li className="flex items-start gap-[12px] text-body font-medium">
      <Icon className="mt-[-1px] h-[20px] w-[20px] shrink-0 text-muted" />
      <span>{children}</span>
    </li>
  );
}
