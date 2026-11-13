import Link from "next/link";
import { Poster } from "@/components/ui/poster";
import { SectionHeading } from "@/components/ui/section-heading";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { MoreForYou } from "@/components/events/more-for-you";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { personalizeEvents, soonestFirst } from "@/lib/muse/rank";
import { friendsGoingLine, whoIsGoing } from "@/lib/social/going";
import { demoViewer } from "@/lib/social/viewer";

// Muse's top 3 for today (today's events only), as a sideways row of compact cards. Why each event
// was picked stays inside the agent and is not shown. Who picked them
// (Muse or the local fallback) is not shown either. Under it, every other event the
// student is likely to care about.

export async function TopPicks({ events, now }: { events: CampusEvent[]; now: Date }) {
  const ranking = await personalizeEvents(loadDemoStudent(), events, now);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const viewer = demoViewer();

  const pickedIds = new Set(ranking.data?.picks.map((pick) => pick.eventId));
  const more = soonestFirst(
    ranking.data?.likely.filter((candidate) => !pickedIds.has(candidate.eventId)) ?? [],
    events,
    now,
  );

  return (
    <>
      <section aria-labelledby="top-picks-heading" className="pt-[22px]">
        <SectionHeading id="top-picks-heading" title="Top 3 for you today" />
        {ranking.error !== null ? (
          <p className="mt-2 px-3 text-body text-muted">Muse could not pick right now. Everything free today is below.</p>
        ) : (
          <ol className="no-scrollbar mt-[10px] flex snap-x snap-mandatory gap-[7.6px] overflow-x-auto scroll-px-3 px-3">
            {ranking.data.picks.map((pick) => {
              const event = eventsById.get(pick.eventId);
              if (!event) return null;
              const friendsGoing = friendsGoingLine(whoIsGoing(event, viewer.id, viewer.interests).friends);
              return (
                <li key={pick.eventId} className="w-[236px] shrink-0 snap-start">
                  <Link
                    href={`/events/${event.id}`}
                    className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card"
                  >
                    <Poster seed={event.id} title={event.title} size="small" imagePath={event.source.imagePath} />
                    <div className="flex flex-1 flex-col px-[10px] pb-[10px] pt-[9px]">
                      <p className="truncate text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
                      <h3 className="mt-[2px] line-clamp-2 font-display text-label font-bold">{event.title}</h3>
                      <p className="mt-[1px] text-meta font-semibold text-muted">
                        {pick.walkMinutes} min walk · {event.free ? "Free" : "Paid entry"}
                      </p>
                      {friendsGoing && <p className="mt-[3px] truncate text-meta font-semibold">{friendsGoing}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <MoreForYou likely={more} events={events} now={now} />
    </>
  );
}

export function TopPicksSkeleton() {
  return (
    <section className="pt-[22px]">
      <SectionHeading title="Top 3 for you today" />
      <div className="mt-[10px] flex gap-[7.6px] overflow-hidden px-3">
        {[0, 1].map((index) => (
          <div key={index} className="h-[214px] w-[236px] shrink-0 rounded-card border border-hairline bg-wash" />
        ))}
      </div>
    </section>
  );
}
