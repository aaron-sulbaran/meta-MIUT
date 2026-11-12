import { EventsHeatmap, type MapCard } from "@/components/map/events-heatmap";
import { loadSeedStudent } from "@/lib/events/seed";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";
import { eventCategory } from "@/lib/map/category";
import { heatPoints } from "@/lib/map/heat";
import { rankEvents } from "@/lib/muse/rank";

// Server half of the map home: asks Muse for this student's picks, turns them
// into heat, and hands plain data to the client map.

export async function MapHome({ events, now }: { events: CampusEvent[]; now: Date }) {
  const student = loadSeedStudent();
  const ranking = await rankEvents(student, events, now);
  const picks = ranking.error === null ? ranking.data : [];
  const eventsById = new Map(events.map((event) => [event.id, event]));

  const cards: MapCard[] = heatPoints(events, picks, student.home, now).flatMap((point) => {
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
        weight: point.weight,
        pickRank: point.pickRank,
        reason: point.reason,
      },
    ];
  });

  return <EventsHeatmap cards={cards} studentSpot={student.home} museLive={ranking.source === "muse"} />;
}

export function MapHomeSkeleton() {
  return (
    <div className="-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] flex h-[calc(100dvh-52px-env(safe-area-inset-top))] w-full items-center justify-center bg-wash">
      <p className="text-meta font-semibold text-muted">Muse is finding hotspots near you</p>
    </div>
  );
}
