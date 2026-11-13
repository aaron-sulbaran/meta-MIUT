import Link from "next/link";
import { monogram } from "@/components/map/category-icons";
import { Poster } from "@/components/ui/poster";
import { SectionHeading } from "@/components/ui/section-heading";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";
import { organizerLogo } from "@/lib/map/organizer-logos";
import { MoreForYou } from "@/components/events/more-for-you";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { compileCandidates } from "@/lib/muse/candidates";
import { forYouOrder, personalizeEvents } from "@/lib/muse/rank";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { friendsGoingLine, loadSocial, whoIsGoing } from "@/lib/social/going";
import { demoViewer } from "@/lib/social/viewer";

// Muse's top 3 for today, as three same-size image tiles that fit one
// phone-width row (lisa): the flyer fills the tile (the poster composition
// when there is none), the organizer's logo sits in the top corner, and the
// title, time and walk sit on a dark band. When today has fewer than three
// picks, the next events in Muse's For you order fill the row. Why each event
// was picked stays inside the agent and is not shown. Who picked them
// (Muse or the local fallback) is not shown either. Under it, every other upcoming event,
// the ones the student is likely to care about first.

// Single-line text that ends in an ellipsis, set inline so it holds in the
// narrow tiles.
const ONE_LINE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

export async function TopPicks({ events, now }: { events: CampusEvent[]; now: Date }) {
  const student = loadDemoStudent();
  const memory = await loadInterestMemory(DEMO_USER_ID, now);
  const ranking = await personalizeEvents(student, events, now, memory);
  await loadSocial(ranking.data?.picks.map((pick) => pick.eventId) ?? []);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const viewer = demoViewer();

  const pickedIds = new Set(ranking.data?.picks.map((pick) => pick.eventId));
  const ordered = forYouOrder(compileCandidates(student, memory, events, now, "upcoming"), events, now, pickedIds);
  const picks = ranking.data?.picks ?? [];
  const fill = ordered.slice(0, Math.max(0, 3 - picks.length));
  const tiles = [
    ...picks.map((pick) => ({ eventId: pick.eventId, walkMinutes: pick.walkMinutes })),
    ...fill.map((event) => ({ eventId: event.id, walkMinutes: walkMinutes(student.home, event.place) })),
  ];
  const more = ordered.slice(fill.length);

  return (
    <>
      <section aria-labelledby="top-picks-heading" className="pt-[22px]">
        <SectionHeading id="top-picks-heading" title={fill.length > 0 ? "Top 3 for you" : "Top 3 for you today"} />
        {tiles.length === 0 ? (
          <p className="mt-2 px-3 text-body text-muted">Muse could not pick right now. Everything free today is below.</p>
        ) : (
          <ol className="mt-[10px] grid grid-cols-3 gap-[6px] px-3">
            {tiles.map((tile) => {
              const event = eventsById.get(tile.eventId);
              if (!event) return null;
              const friendsGoing = friendsGoingLine(whoIsGoing(event, viewer.id, viewer.interests).friends);
              const logo = organizerLogo(event.organizer);
              return (
                <li key={tile.eventId}>
                  <Link href={`/events/${event.id}`} className="relative block h-[200px] overflow-hidden rounded-[14px] bg-wash">
                    {event.source.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.source.imagePath} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <Poster seed={event.id} title="" size="small" className="absolute inset-0 h-full !aspect-auto" />
                    )}
                    <span className="absolute left-[6px] top-[6px] flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white text-[9px] font-semibold text-[#0c447c] shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-[2px]" />
                      ) : (
                        monogram(event.organizer.name)
                      )}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-[7px] pb-[7px] pt-[6px] text-white">
                      <h3 className="line-clamp-2 font-display text-[12px] font-bold leading-[14px]">{event.title}</h3>
                      <p className="mt-[2px] text-[10px] font-semibold leading-[13px] text-white/85" style={ONE_LINE}>
                        {formatDateLine(event, now)}
                      </p>
                      <p className="text-[10px] font-semibold leading-[13px] text-white/85" style={ONE_LINE}>
                        {tile.walkMinutes} min · {event.free ? "Free" : "Paid"}
                      </p>
                      {friendsGoing && (
                        <p className="mt-[1px] text-[10px] font-semibold leading-[13px]" style={ONE_LINE}>
                          {friendsGoing}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <MoreForYou events={more} nowIso={now.toISOString()} />
    </>
  );
}

export function TopPicksSkeleton() {
  return (
    <section className="pt-[22px]">
      <SectionHeading title="Top 3 for you today" />
      <div className="mt-[10px] grid grid-cols-3 gap-[6px] px-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-[200px] rounded-[14px] bg-wash" />
        ))}
      </div>
    </section>
  );
}
