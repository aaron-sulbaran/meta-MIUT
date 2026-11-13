import { connection } from "next/server";
import { OrganizerFlow, type OrganizerHandoff } from "@/components/organizer/organizer-flow";
import type { OrganizerOption } from "@/components/organizer/types";
import { STORY_POST, flyerUrl, storyCaption } from "@/lib/demo/staged";
import { getEventStore } from "@/lib/events/store";
import { SAMPLE_FLYER_CAPTION } from "@/lib/muse/fixtures/extract";
import { knownPlacesFrom } from "@/lib/organizer/place";

// Organizer side: a flyer photo or a spoken line to a published event in one tap.
// Places and titles come from the events already listed, so the screen follows
// whichever campus the seed is set to. The organizer posts as their signed-in
// club only, and the manual inputs are a greyed-out placeholder (Lisa). ?say= is a spoken line handed over
// from Ask Muse; Muse drafts it right away. ?handoff=story is the demo's staged
// Instagram post (O1, O2), also reached as ?from=instagram from the /demo stage: its
// flyer and caption go straight to Muse, no picker;
// ?at=<ISO> keeps the demo clock the post used.
export default async function OrganizerPage({
  searchParams,
}: {
  searchParams: Promise<{ say?: string | string[]; handoff?: string; from?: string; at?: string }>;
}) {
  const { say, handoff, from, at } = await searchParams;
  await connection();
  const events = await getEventStore().listEvents();

  // The organizer posts only as the club they are signed in as on Instagram
  // (Lisa): for the demo that is the story post's club, never a list of clubs.
  const signedIn: OrganizerOption = { ...STORY_POST.organizer };
  const organizers: OrganizerOption[] = [signedIn];

  const now = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();
  const story: OrganizerHandoff | null =
    handoff === "story" || from === "instagram" ? { flyerSrc: flyerUrl(now), caption: storyCaption(now), organizer: { ...STORY_POST.organizer } } : null;

  return (
    <OrganizerFlow
      places={knownPlacesFrom(events)}
      organizers={organizers}
      eventTitles={Object.fromEntries(events.map((event) => [event.id, event.title]))}
      sampleCaption={SAMPLE_FLYER_CAPTION}
      said={typeof say === "string" ? say.trim().slice(0, 1000) : ""}
      handoff={story}
    />
  );
}
