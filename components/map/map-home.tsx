import { EventsHeatmap, type MapCard, type MapChip } from "@/components/map/events-heatmap";
import { loadSeedStudent } from "@/lib/events/seed";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, isInWindow } from "@/lib/events/time";
import { eventCategory } from "@/lib/map/category";
import { heatPoints } from "@/lib/map/heat";
import { personalizeEvents } from "@/lib/muse/rank";

// Server half of the map home: asks Muse for this student's picks (with their
// interest memory, see personalizeEvents), turns picks and likely scores into
// heat, and hands plain data to the client map.

function mapChips(event: CampusEvent, now: Date): MapChip[] {
  const chips: MapChip[] = [];
  if (event.free && event.food) chips.push("freeFood");
  if (isInWindow(event, "now", now)) chips.push("now");
  if (isInWindow(event, "today", now)) chips.push("today");
  return chips;
}

export async function MapHome({ events, now }: { events: CampusEvent[]; now: Date }) {
  const student = loadSeedStudent();
  const ranking = await personalizeEvents(student, events, now);
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
        imagePath: event.source.imagePath ?? null,
        chips: mapChips(event, now),
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
