import { connection } from "next/server";
import { OrganizerFlow } from "@/components/organizer/organizer-flow";
import type { OrganizerOption } from "@/components/organizer/types";
import { getEventStore } from "@/lib/events/store";
import { SAMPLE_FLYER_CAPTION } from "@/lib/muse/fixtures/extract";
import { knownPlacesFrom } from "@/lib/organizer/place";

// Organizer side: a flyer photo or a spoken line to a published event in one tap.
// Places, organizers, and titles come from the events already listed, so the screen
// follows whichever campus the seed is set to. ?say= is a spoken line handed over
// from Ask Muse; Muse drafts it right away.
export default async function OrganizerPage({ searchParams }: { searchParams: Promise<{ say?: string | string[] }> }) {
  const { say } = await searchParams;
  await connection();
  const events = await getEventStore().listEvents();

  const organizers: OrganizerOption[] = [];
  const seenHandles = new Set<string>();
  for (const { organizer } of events) {
    const key = organizer.handle.toLowerCase();
    if (seenHandles.has(key)) continue;
    seenHandles.add(key);
    organizers.push({ name: organizer.name, handle: organizer.handle });
  }
  organizers.sort((first, second) => first.name.localeCompare(second.name));

  return (
    <OrganizerFlow
      places={knownPlacesFrom(events)}
      organizers={organizers}
      eventTitles={Object.fromEntries(events.map((event) => [event.id, event.title]))}
      sampleCaption={SAMPLE_FLYER_CAPTION}
      said={typeof say === "string" ? say.trim().slice(0, 1000) : ""}
    />
  );
}
