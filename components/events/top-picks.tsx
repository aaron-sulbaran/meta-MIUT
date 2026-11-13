import Link from "next/link";
import { monogram } from "@/components/map/category-icons";
import { Poster } from "@/components/ui/poster";
import { SourceBadge } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { organizerLogo } from "@/lib/map/organizer-logos";
import { OrganizerLogoImg } from "@/components/map/organizer-logo-img";
import { MoreForYou } from "@/components/events/more-for-you";
import { HandoffLink } from "@/components/curate/handoff-link";
import { MetaAiMark } from "@/components/ui/meta-ai-mark";
import { ownTopPicks, type OwnTopPicks } from "@/lib/curate/picks";
import { HANDOFF } from "@/lib/demo/staged";
import { walkMinutes } from "@/lib/geo";
import { currentViewer, demoViewer, type Viewer } from "@/lib/social/viewer";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { forYouFeed } from "@/lib/muse/rank";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { friendsGoingLine, loadSocial, whoIsGoing } from "@/lib/social/going";


// Muse's top 3 for today, as three same-size image tiles that fit one
// phone-width row (lisa): the flyer fills the tile (the poster composition
// when there is none), the organizer's logo sits in the top corner, and the
// title, time and walk sit on a dark band. When today has fewer than three
// picks, the next events in Muse's For you order fill the row. Why each event
// was picked stays inside the agent and is not shown. When Muse answered, who
// picked them is not shown either; when Muse could not (no key, a failed call),
// the heading says "Recorded answer", so the live link never passes a fallback
// off as Muse (t-y3dg). Under it, every other upcoming event, the ones the
// student is likely to care about first (ordered by interest, not by Muse).
//
// A viewer who let Muse build their feed on their first visit (lib/curate/picks.ts)
// sees their own three picks instead of the sample student's, under Muse's one line
// about them and the honest stamp (live with the call's time, or Recorded answer).
// On the onboarding's List (?first=1) a tap tells the /demo stage it moved on.

// Single-line text that ends in an ellipsis, set inline so it holds in the
// narrow tiles.
const ONE_LINE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

export async function TopPicks({ events, now, firstVisit = false }: { events: CampusEvent[]; now: Date; firstVisit?: boolean }) {
  const viewer = await currentViewer();
  const own = await ownTopPicks(viewer.id, events, now, firstVisit);
  if (own) return <OwnTopPicksSection own={own} events={events} now={now} viewer={viewer} firstVisit={firstVisit} />;
  const student = loadDemoStudent();
  const memory = await loadInterestMemory(DEMO_USER_ID, now);
  const { ranking, tiles, rest: more } = await forYouFeed(student, events, now, memory);
  await loadSocial(ranking.data?.picks.map((pick) => pick.eventId) ?? []);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const sample = demoViewer();
  const fill = tiles.slice(ranking.data?.picks.length ?? 0);

  return (
    <>
      <section aria-labelledby="top-picks-heading" className="pt-[22px]">
        <SectionHeading
          id="top-picks-heading"
          title={fill.length > 0 ? "Top 3 for you" : "Top 3 for you today"}
          aside={ranking.source === "muse" ? undefined : <SourceBadge source="fixture" />}
        />
        {tiles.length === 0 ? (
          <p className="mt-2 px-3 text-body text-muted">Muse could not pick right now. Everything free today is below.</p>
        ) : (
          <ol className="mt-[10px] grid grid-cols-3 gap-[6px] px-3">
            {tiles.map((tile) => {
              const event = eventsById.get(tile.eventId);
              return event ? (
                <PickTile key={tile.eventId} event={event} now={now} viewer={sample} walk={tile.walkMinutes} href={`/events/${event.id}`} />
              ) : null;
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

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** One Top 3 tile: the flyer or poster, the organizer's logo, and the title, time and walk on a dark band. */
function PickTile({ event, now, viewer, walk, href, handoff = false }: { event: CampusEvent; now: Date; viewer: Viewer; walk: number; href: string; handoff?: boolean }) {
  const friendsGoing = friendsGoingLine(whoIsGoing(event, viewer.id, viewer.interests).friends);
  const logo = organizerLogo(event.organizer);
  const className = "relative block h-[200px] overflow-hidden rounded-[14px] bg-wash";
  const body = (
    <>
      {event.source.imagePath ? (
        // Anchored left: a wide flyer cropped into the narrow tile keeps the start of its title.
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" decoding="async" src={event.source.imagePath} alt="" className="absolute inset-0 h-full w-full object-cover object-left" />
      ) : (
        <Poster seed={event.id} title="" size="small" className="absolute inset-0 h-full !aspect-auto" />
      )}
      <span className="absolute left-[6px] top-[6px] flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white text-[9px] font-semibold text-[#0c447c] shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        {logo ? (
          <OrganizerLogoImg src={logo} className="h-full w-full object-contain p-[2px]" fallback={monogram(event.organizer.name)} />
        ) : (
          monogram(event.organizer.name)
        )}
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-[7px] pb-[7px] pt-[6px] text-white">
        <h3 className="line-clamp-2 min-h-[28px] font-display text-[12px] font-bold leading-[14px]">{event.title}</h3>
        <p className="mt-[2px] text-[10px] font-semibold leading-[13px] text-white/85" style={ONE_LINE}>
          {formatDateLine(event, now)}
        </p>
        <p className="text-[10px] font-semibold leading-[13px] text-white/85" style={ONE_LINE}>
          {walk} min · {event.free ? "Free" : "Paid"}
        </p>
        <p className="mt-[1px] text-[10px] font-semibold leading-[13px]" style={ONE_LINE}>
          {friendsGoing ?? "\u00a0"}
        </p>
      </div>
    </>
  );
  return (
    <li>
      {handoff ? (
        <HandoffLink href={href} className={className}>
          {body}
        </HandoffLink>
      ) : (
        <Link href={href} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** The viewer's own Top 3 from their first-visit curate, with Muse's line and the honest stamp. */
async function OwnTopPicksSection({ own, events, now, viewer, firstVisit }: { own: OwnTopPicks; events: CampusEvent[]; now: Date; viewer: Viewer; firstVisit: boolean }) {
  await loadSocial(own.eventIds);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const picked = own.eventIds.flatMap((id) => {
    const event = eventsById.get(id);
    return event ? [event] : [];
  });
  const pickedTitles = new Set(picked.map((event) => event.title.toLowerCase()));
  const more = events
    .filter((event) => Date.parse(event.end) > now.getTime() && event.status === "published" && !pickedTitles.has(event.title.toLowerCase()))
    .sort((first, second) => Date.parse(first.start) - Date.parse(second.start));
  const home = loadDemoStudent().home;
  const live = own.source === "muse";

  return (
    <>
      <section aria-labelledby="top-picks-heading" className="pt-[22px]">
        <SectionHeading id="top-picks-heading" title="Top 3 for you" aside={live ? undefined : <SourceBadge source="fixture" />} />
        <div className="mt-[6px] flex items-start gap-[7px] px-3">
          <MetaAiMark size={18} className="mt-[1px]" />
          <div className="min-w-0">
            <p className="text-body font-medium text-ink">{own.summary}</p>
            <p className="text-meta text-muted">
              {live ? `Live from Muse${own.museMs ? ` · picked ${seconds(own.museMs)}` : ""}` : "Recorded picks for the demo, not a live answer"}
            </p>
          </div>
        </div>
        <ol className="mt-[10px] grid grid-cols-3 gap-[6px] px-3">
          {picked.map((event) => (
            <PickTile
              key={event.id}
              event={event}
              now={now}
              viewer={viewer}
              walk={walkMinutes(home, event.place)}
              href={firstVisit ? HANDOFF.whosGoing(event.id) : `/events/${event.id}`}
              handoff={firstVisit}
            />
          ))}
        </ol>
      </section>
      <MoreForYou events={more} nowIso={now.toISOString()} />
    </>
  );
}
