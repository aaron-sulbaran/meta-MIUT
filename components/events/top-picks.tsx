import Link from "next/link";
import { MuseMark } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { SectionHeading } from "@/components/ui/section-heading";
import { loadSeedStudent } from "@/lib/events/seed";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { rankEvents } from "@/lib/muse/rank";

// Muse's top 3 for today, as a sideways row of compact cards. Each card gives
// one plain reason. A quiet line under the heading says whether Muse answered
// live or the recorded picks are showing.

export async function TopPicks({ events, now }: { events: CampusEvent[]; now: Date }) {
  const ranking = await rankEvents(loadSeedStudent(), events, now);
  const eventsById = new Map(events.map((event) => [event.id, event]));

  return (
    <section aria-labelledby="top-picks-heading" className="pt-[22px]">
      <SectionHeading id="top-picks-heading" title="Top 3 for you today" />
      <p className="mt-[2px] flex items-center gap-[5px] px-3 text-meta font-semibold text-muted">
        <MuseMark className="h-[13px] w-[13px] text-primary" />
        {ranking.source === "muse" ? "Picked by Muse from your schedule and follows" : "Recorded picks while Muse is offline"}
      </p>
      {ranking.error !== null ? (
        <p className="mt-2 px-3 text-body text-muted">Muse could not pick right now. Everything free today is below.</p>
      ) : (
        <ol className="no-scrollbar mt-[10px] flex snap-x snap-mandatory gap-[7.6px] overflow-x-auto scroll-px-3 px-3">
          {ranking.data.map((pick) => {
            const event = eventsById.get(pick.eventId);
            if (!event) return null;
            return (
              <li key={pick.eventId} className="w-[236px] shrink-0 snap-start">
                <Link
                  href={`/events/${event.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card"
                >
                  <Poster seed={event.id} title={event.title} size="small" />
                  <div className="flex flex-1 flex-col px-[10px] pb-[10px] pt-[9px]">
                    <p className="truncate text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
                    <h3 className="mt-[2px] line-clamp-2 font-display text-label font-bold">{event.title}</h3>
                    <p className="mt-[1px] text-meta font-semibold text-muted">
                      {pick.walkMinutes} min walk · {event.free ? "Free" : "Paid entry"}
                    </p>
                    <p className="mt-auto flex items-start gap-[5px] pt-[6px] text-venue font-semibold text-ink">
                      <MuseMark className="mt-[1.5px] h-[13px] w-[13px] shrink-0 text-primary" />
                      <span className="line-clamp-2">{pick.reason}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function TopPicksSkeleton() {
  return (
    <section className="pt-[22px]">
      <SectionHeading title="Top 3 for you today" />
      <p className="mt-[2px] flex items-center gap-[5px] px-3 text-meta font-semibold text-muted">
        <MuseMark className="h-[13px] w-[13px] text-primary" />
        Muse is picking
      </p>
      <div className="mt-[10px] flex gap-[7.6px] overflow-hidden px-3">
        {[0, 1].map((index) => (
          <div key={index} className="h-[214px] w-[236px] shrink-0 rounded-card border border-hairline bg-wash" />
        ))}
      </div>
    </section>
  );
}
