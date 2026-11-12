import Link from "next/link";
import type { CampusEvent } from "@/lib/events/schema";
import { formatEventTime } from "@/lib/events/time";
import { MapPinIcon } from "@/components/ui/icons";

export function EventBadges({ event }: { event: CampusEvent }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {event.free && <span className="rounded bg-[#e3f4e7] px-1.5 py-0.5 text-[11px] font-semibold text-free">Free</span>}
      {event.food && <span className="rounded bg-wash px-1.5 py-0.5 text-[11px] font-semibold text-muted">Food</span>}
      {event.access.kind === "rsvp" && (
        <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          RSVP{event.access.capacity ? `, ${event.access.capacity} spots` : ""}
        </span>
      )}
    </div>
  );
}

export function EventCard({ event, now }: { event: CampusEvent; now: Date }) {
  return (
    <Link href={`/events/${event.id}`} className="block rounded-lg bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#e41e3f]">{formatEventTime(event, now)}</p>
      <h3 className="mt-1 text-[17px] font-semibold leading-snug">{event.title}</h3>
      <p className="mt-1 flex items-center gap-1 text-[14px] text-muted">
        <MapPinIcon className="h-4 w-4 shrink-0" />
        {event.place.name}
      </p>
      <p className="mt-0.5 text-[13px] text-muted">by {event.organizer.name}</p>
      <div className="mt-2">
        <EventBadges event={event} />
      </div>
    </Link>
  );
}
