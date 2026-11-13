import { FbEventCard } from "@/components/ui/event-card";
import { Poster } from "@/components/ui/poster";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, freePerk } from "@/lib/events/time";

/** What the card's grey meta line says: only facts the event carries. */
export function eventFacts(event: CampusEvent): string {
  const facts = [event.free ? "Free" : "Paid entry"];
  const perk = freePerk(event);
  if (perk) facts.push(perk);
  else if (event.food) facts.push(event.foodNote ?? "Food");
  if (event.access.kind === "rsvp") {
    facts.push(event.access.capacity ? `RSVP, ${event.access.capacity} spots` : "RSVP");
  }
  return facts.join(" · ");
}

export function posterKicker(event: CampusEvent): string {
  return event.organizer.name;
}

export function EventCard({ event, now, from }: { event: CampusEvent; now: Date; from?: "ask" }) {
  return (
    <FbEventCard
      href={`/events/${event.id}${from ? `?from=${from}` : ""}`}
      image={<Poster seed={event.id} title={event.title} kicker={posterKicker(event)} imagePath={event.source.imagePath} />}
      dateLine={formatDateLine(event, now)}
      title={event.title}
      venue={event.place.name}
      meta={eventFacts(event)}
    />
  );
}
