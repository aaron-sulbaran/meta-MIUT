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

// For you is only what Muse recommends, as on the list: the Top 3 plus every
// event the student is likely to care about (t-rnbc). Free is free and open to
// all, recommended or not; a free event that needs an RSVP for limited seats
// is not on Free (d-r6zd).
function mapChips(event: CampusEvent, recommended: Set<string>): MapChip[] {
  const chips: MapChip[] = [];
  if (recommended.has(event.id)) chips.push("forYou");
  if (event.free && event.access.kind === "open") chips.push("free");
  return chips;
}

export async function MapHome({ events, now }: { events: CampusEvent[]; now: Date }) {
  const student = loadDemoStudent();
  const ranking = await personalizeEvents(student, events, now, await loadInterestMemory(DEMO_USER_ID, now));
  const picks = ranking.error === null ? ranking.data.picks : [];
  const likely = ranking.error === null ? ranking.data.likely : undefined;
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const recommended = new Set([...picks.map((pick) => pick.eventId), ...(likely ?? []).map((item) => item.eventId)]);

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
        chips: mapChips(event, recommended),
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
