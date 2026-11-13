import type { AskPlanLink } from "@/components/map/events-map";
import { EventsMap, type MapCard, type MapChip } from "@/components/map/events-map";
import { nearestFreeBite } from "@/lib/demo/free-bite";
import { pickStoryEvent } from "@/lib/demo/story";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, freePerk, isOpenFree } from "@/lib/events/time";
import { classJustEnded } from "@/lib/map/class-start";
import { eventCategory } from "@/lib/map/category";
import { heatPoints } from "@/lib/map/heat";
import { organizerLogo } from "@/lib/map/organizer-logos";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { forYouFeed } from "@/lib/muse/rank";

// Server half of the map home: takes the same For you order as the list
// (forYouFeed: its Top 3, then the rest) and hands plain data to the client map.

// For you matches the list (#15): every upcoming event, in Muse's order (the
// cards are already sorted picks first, then by interest). Free matches the
// list's Free tab (isOpenFree): free, open, and something to take away.
function mapChips(event: CampusEvent): MapChip[] {
  return isOpenFree(event) ? ["forYou", "free"] : ["forYou"];
}

export async function MapHome({
  events,
  now,
  autoPlan = null,
  planAt = null,
  askPlan = null,
  autoAsk = null,
  holdReveal = false,
}: {
  events: CampusEvent[];
  now: Date;
  /** "home": open with Muse's walk from class to home planned (?plan=home, the alert link). */
  autoPlan?: "home" | "choose" | null;
  /** A set campus time (ISO) the map's walks plan from (?time=, for the demo). */
  planAt?: string | null;
  /** A walk Ask Muse planned (?plan=ask&note=&to=): open with it drawn. */
  askPlan?: AskPlanLink | null;
  /** Demo hook (?auto=1): a question Ask Muse asks on its own once the map is up. */
  autoAsk?: string | null;
  /** Loaded ahead by the /demo stage (?reveal=wait): Muse's plan waits for the stage's reveal message. */
  holdReveal?: boolean;
}) {
  const student = loadDemoStudent();
  const { ranking, tiles, rest } = await forYouFeed(student, events, now, await loadInterestMemory(DEMO_USER_ID, now));
  const likely = ranking.error === null ? ranking.data.likely : undefined;
  const eventsById = new Map(events.map((event) => [event.id, event]));
  // Cards in the list's order: its Top 3 tiles, then the rest of For you. Heat only sizes bubbles.
  const topPicks = tiles.map((tile) => ({ eventId: tile.eventId, reason: tile.reason ?? "", walkMinutes: tile.walkMinutes }));
  const order = new Map([...tiles.map((tile) => tile.eventId), ...rest.map((event) => event.id)].map((id, index) => [id, index]));
  const points = heatPoints(events, topPicks, student.home, now, likely).sort(
    (a, b) => (order.get(a.eventId) ?? Infinity) - (order.get(b.eventId) ?? Infinity),
  );

  const cards: MapCard[] = points.flatMap((point) => {
    const event = eventsById.get(point.eventId);
    if (!event) return [];
    return [
      {
        eventId: event.id,
        title: event.title,
        place: event.place,
        dateLine: formatDateLine(event, now),
        free: event.free,
        perk: freePerk(event),
        imagePath: event.source.imagePath ?? null,
        category: eventCategory(event),
        organizerName: event.organizer.name,
        logoUrl: organizerLogo(event.organizer),
        chips: mapChips(event),
        startIso: event.start,
        endIso: event.end,
        weight: point.weight,
        pickRank: point.pickRank,
        reason: point.reason,
      },
    ];
  });

  // The walk starts where the student's class was (profile.home is the class building).
  const lastClass = classJustEnded(student.schedule, planAt ? new Date(planAt) : now);
  return (
    <EventsMap
      cards={cards}
      studentSpot={student.home}
      askEvents={events}
      nowIso={now.toISOString()}
      autoPlan={autoPlan}
      planAt={planAt}
      askPlan={askPlan}
      startLabel={lastClass ? `Out of ${lastClass}` : null}
      schedule={student.schedule}
      autoAsk={autoAsk}
      holdReveal={holdReveal}
      // The alert path: the stop the class-ended alert promised leads the walk, and a friend
      // re-plan lands on the event the demo follows when there is one (lib/demo/story.ts).
      promisedStopId={autoPlan === "home" ? (nearestFreeBite(events, student.home, planAt ? new Date(planAt) : now)?.eventId ?? null) : null}
      storyEventId={autoPlan === "home" ? (pickStoryEvent(events)?.id ?? null) : null}
    />
  );
}

export function MapHomeSkeleton() {
  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] flex h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full items-center justify-center bg-wash">
      <p className="text-meta font-semibold text-muted">Muse is finding hotspots near you</p>
    </div>
  );
}
