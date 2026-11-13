import { connection } from "next/server";
import { OrganizerFlow, type OrganizerHandoff } from "@/components/organizer/organizer-flow";
import type { OrganizerOption } from "@/components/organizer/types";
import { PostedEvent } from "@/components/demo/moments/posted-event";
import { HANDOFF, STORY_POST, flyerUrl, storyCaption, storyTimeLine } from "@/lib/demo/staged";
import { ensureStoryEvent } from "@/lib/demo/story";
import { getEventStore } from "@/lib/events/store";
import { knownPlacesFrom } from "@/lib/organizer/place";

// Organizer side: a flyer photo or a spoken line to a published event in one tap.
// Places and titles come from the events already listed, so the screen follows
// whichever campus the seed is set to. The organizer posts as their signed-in
// club only. There are no manual inputs: a draft comes from a post or Ask Muse. ?say= is a spoken line handed over
// from Ask Muse; Muse drafts it right away. ?handoff=story is the demo's staged
// Instagram post (O1, O2), also reached as ?from=instagram from the /demo stage: its
// flyer and caption go straight to Muse, no picker;
// ?at=<ISO> keeps the demo clock the post used. ?state=posted (O5) shows the
// story event as posted to Facebook Events, without running Muse again.
export default async function OrganizerPage({
  searchParams,
}: {
  searchParams: Promise<{ say?: string | string[]; handoff?: string; from?: string; at?: string; state?: string }>;
}) {
  const { say, handoff, from, at, state } = await searchParams;
  await connection();
  const now = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();

  if (state === "posted") {
    const story = await ensureStoryEvent(now);
    if (story.data) {
      return (
        <div className="px-[12px] pt-[12px] pb-[16px]">
          <PostedEvent event={story.data} alert={null} flyerSrc={flyerUrl(now)} now={now} />
        </div>
      );
    }
  }

  const events = await getEventStore().listEvents();

  // The organizer posts only as the club they are signed in as on Instagram
  // (Lisa): for the demo that is the story post's club, never a list of clubs.
  const signedIn: OrganizerOption = { ...STORY_POST.organizer };
  const organizers: OrganizerOption[] = [signedIn];

  const story: OrganizerHandoff | null =
    handoff === "story" || from === "instagram"
      ? {
          flyerSrc: flyerUrl(now),
          caption: storyCaption(now),
          organizer: { ...STORY_POST.organizer },
          timeLine: storyTimeLine(now),
          nowIso: now.toISOString(),
          postedPath: HANDOFF.organizerPosted(at ?? null),
        }
      : null;

  return (
    <OrganizerFlow
      places={knownPlacesFrom(events)}
      organizers={organizers}
      eventTitles={Object.fromEntries(events.map((event) => [event.id, event.title]))}
      said={typeof say === "string" ? say.trim().slice(0, 1000) : ""}
      handoff={story}
    />
  );
}
