import { EventsMap, type MapCard, type MapChip } from "@/components/map/events-map";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { eventCategory } from "@/lib/map/category";
import { heatPoints } from "@/lib/map/heat";
import { organizerLogo } from "@/lib/map/organizer-logos";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { personalizeEvents } from "@/lib/muse/rank";

// Server half of the map home: asks Muse for this student's picks with the
// same student and shared interest memory as the Top 3 on the list, orders the
// events by them, and hands plain data to the client map.

// For you matches the list (#15): every upcoming event, in Muse's order (the
// cards are already sorted picks first, then by interest). Free is free and
// open to all; a free event that needs an RSVP for limited seats is not on
// Free (d-r6zd).
function mapChips(event: CampusEvent): MapChip[] {
  return event.free && event.access.kind === "open" ? ["forYou", "free"] : ["forYou"];
}

export async function MapHome({
  events,
  now,
  autoPlan = null,
  planAt = null,
}: {
  events: CampusEvent[];
  now: Date;
  /** "home": open with Muse's walk from class to home planned (?plan=home, the alert link). */
  autoPlan?: "home" | null;
  /** A set campus time (ISO) the map's walks plan from (?time=, for the demo). */
  planAt?: string | null;
}) {
  const student = loadDemoStudent();
  const ranking = await personalizeEvents(student, events, now, await loadInterestMemory(DEMO_USER_ID, now));
  const picks = ranking.error === null ? ranking.data.picks : [];
  const likely = ranking.error === null ? ranking.data.likely : undefined;
  const eventsById = new Map(events.map((event) => [event.id, event]));

  const cards: MapCard[] = heatPoints(events, picks, student.home, now, likely).flatMap((point) => {
    const event = eventsById.get(point.eventId);
    if (!event) return [];
    return [
      {
        eventId: event.id,
        title: event.title,
        place: event.place,
        dateLine: formatDateLine(event, now),
        free: event.free,
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

  return <EventsMap cards={cards} studentSpot={student.home} askEvents={events} nowIso={now.toISOString()} autoPlan={autoPlan} planAt={planAt} />;
}

export function MapHomeSkeleton() {
  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] flex h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full items-center justify-center bg-wash">
      <p className="text-meta font-semibold text-muted">Muse is finding hotspots near you</p>
    </div>
  );
}
