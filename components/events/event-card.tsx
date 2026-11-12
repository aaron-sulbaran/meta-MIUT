import { FbEventCard } from "@/components/ui/event-card";
import { Poster } from "@/components/ui/poster";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";

/** What the card's grey meta line says: only facts the event carries. */
export function eventFacts(event: CampusEvent): string {
  const facts = [event.free ? "Free" : "Paid entry"];
  if (event.food) facts.push(event.foodNote ?? "Food");
  if (event.access.kind === "rsvp") {
    facts.push(event.access.capacity ? `RSVP, ${event.access.capacity} spots` : "RSVP");
  }
  return facts.join(" · ");
}

export function posterKicker(event: CampusEvent): string {
  return event.organizer.name;
}

export function EventCard({ event, now }: { event: CampusEvent; now: Date }) {
  return (
    <FbEventCard
      href={`/events/${event.id}`}
      image={<Poster seed={event.id} title={event.title} kicker={posterKicker(event)} />}
      dateLine={formatDateLine(event, now)}
      title={event.title}
      venue={event.place.name}
      meta={eventFacts(event)}
    />
  );
}
