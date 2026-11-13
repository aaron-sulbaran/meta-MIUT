import { EventsMap, type MapCard, type MapChip } from "@/components/map/events-map";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, freePerk, isOpenFree } from "@/lib/events/time";
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
// cards are already sorted picks first, then by interest). Free matches the
// list's Free tab (isOpenFree): free, open, and something to take away.
function mapChips(event: CampusEvent): MapChip[] {
  return isOpenFree(event) ? ["forYou", "free"] : ["forYou"];
}

export async function MapHome({ events, now }: { events: CampusEvent[]; now: Date }) {
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
        perk: freePerk(event),
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

  return <EventsMap cards={cards} studentSpot={student.home} />;
}

export function MapHomeSkeleton() {
  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] flex h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full items-center justify-center bg-wash">
      <p className="text-meta font-semibold text-muted">Muse is finding hotspots near you</p>
    </div>
  );
}
