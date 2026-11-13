import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import type { LikelyEvent } from "@/lib/muse/types";

// Every other event in the next 7 days the student is likely to care about,
// what is on now first, then the soonest.
// Why each matched stays inside the agent. Sits under the Top 3 on For you.
export function MoreForYou({ likely, events, now }: { likely: LikelyEvent[]; events: CampusEvent[]; now: Date }) {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const rows = likely.flatMap((candidate) => eventsById.get(candidate.eventId) ?? []);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="more-for-you-heading" className="pt-[21px]">
      <SectionHeading id="more-for-you-heading" title="More you might like" />
      <ul className="mt-[7px] flex flex-col gap-[7.6px] px-3">
        {rows.map((event) => (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="flex flex-col rounded-card border border-hairline bg-card px-[11.3px] py-[10px]"
            >
              <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
              <h3 className="mt-[2px] font-display text-label font-bold">{event.title}</h3>
              <p className="mt-[1px] text-meta font-semibold text-muted">
                {event.place.name} · {event.free ? "Free" : "Paid entry"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
