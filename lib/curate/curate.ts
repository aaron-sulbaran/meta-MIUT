import "server-only";
import { z } from "zod";
import { CAMPUS_NAME, CAMPUS_TIME_ZONE } from "@/lib/brand";
import { USER3_CONNECTORS, type ConnectorSource, type CuratedPick } from "@/lib/curate/connectors";
import type { CampusEvent } from "@/lib/events/schema";
import type { MuseRequest } from "@/lib/muse/client";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// "Curate your event feed" for someone new to Facebook Events: Muse reads what
// they already do (seeded connectors) and picks the three listed events they
// are most likely to go to, best first, each with a one-line reason naming the
// signal. A real Muse call; without a key it falls back to a plain topic match.
//
// The demo story wants its event at number one for User 3 ("a coincidence").
// The connectors lean toward it; if Muse still ranks it lower, it is moved to
// the top and the result says so (`storyPinned`), so the screen can be honest.

export const CURATE_PICK_COUNT = 3;
const CANDIDATE_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export const CurateOutputSchema = z.object({
  summary: z.string().min(1).max(160),
  picks: z
    .array(z.object({ eventId: z.string().min(1), reason: z.string().min(1).max(140) }))
    .min(1)
    .max(CURATE_PICK_COUNT),
});
export type CurateOutput = z.infer<typeof CurateOutputSchema>;

export type CuratedFeed = { summary: string; picks: CuratedPick[]; storyPinned: boolean };

const CURATE_STRUCTURED_OUTPUT = museStructuredOutput("curated_feed", CurateOutputSchema);

/** Upcoming published events worth curating: not over, within the next week. */
export function curateCandidates(events: CampusEvent[], now: Date): CampusEvent[] {
  const horizon = now.getTime() + CANDIDATE_WINDOW_DAYS * DAY_MS;
  return events
    .filter((event) => event.status === "published" && Date.parse(event.end) > now.getTime() && Date.parse(event.start) < horizon)
    .sort((first, second) => Date.parse(first.start) - Date.parse(second.start));
}

export function buildCurateRequest(events: CampusEvent[], connectors: ConnectorSource[], now: Date): MuseRequest {
  const signals = connectors.map((source) => `${source.label}:\n${source.items.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
  const listing = events
    .map(
      (event) =>
        `- id ${event.id} | ${event.title} | ${event.start} to ${event.end} | ${event.place.name} | ${event.organizer.name} (@${event.organizer.handle}) | ${event.free ? "free" : "paid"}${event.food ? `, food: ${event.foodNote ?? "yes"}` : ""}`,
    )
    .join("\n");
  return {
    system: [
      `You set up a first events feed for a ${CAMPUS_NAME} student who just turned on Facebook Events.`,
      `Use only the signals given from their connected accounts. Pick the ${CURATE_PICK_COUNT} listed events they are most likely to go to, best first.`,
      "Use only ids from the list. For each pick write one short reason (under 15 words) that names the signal it came from,",
      'for example "You follow @mit_film and it is free after your last class."',
      "Also write a one-line summary of what you learned about them, under 20 words, in the second person.",
      'Return one JSON object: {"summary": string, "picks": [{"eventId": string, "reason": string}]}.',
    ].join(" "),
    prompt: `Now is ${now.toISOString()} (campus time zone ${CAMPUS_TIME_ZONE}).\n\nSignals:\n${signals}\n\nEvents:\n${listing}`,
    structuredOutput: CURATE_STRUCTURED_OUTPUT,
  };
}

const WORD = /[a-z]+/g;

/** Without Muse: events whose words overlap the signals most, story event first. */
export function curateFixture(events: CampusEvent[], connectors: ConnectorSource[], storyEventId: string | null): CurateOutput {
  const signalWords = new Set(connectors.flatMap((source) => source.items.join(" ").toLowerCase().match(WORD) ?? []).filter((word) => word.length > 3));
  const scored = events
    .map((event) => {
      const words = `${event.title} ${event.description} ${event.foodNote ?? ""}`.toLowerCase().match(WORD) ?? [];
      return { event, score: words.filter((word) => signalWords.has(word)).length + (event.id === storyEventId ? 100 : 0) };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, CURATE_PICK_COUNT);
  return {
    summary: "You like board games, late-night food, and film, and you are free after class.",
    picks: scored.map(({ event }) => ({
      eventId: event.id,
      reason: event.food ? `Free ${event.foodNote?.toLowerCase() ?? "food"}, and it matches what you follow.` : "Matches what you follow and watch.",
    })),
  };
}

/** Puts the story event first when it is listed, keeping Muse's reason if it gave one. */
export function pinStory(output: CurateOutput, storyEventId: string | null, events: CampusEvent[]): CuratedFeed {
  const picks = [...output.picks];
  if (!storyEventId || !events.some((event) => event.id === storyEventId) || picks[0]?.eventId === storyEventId) {
    return { summary: output.summary, picks, storyPinned: false };
  }
  const existing = picks.findIndex((pick) => pick.eventId === storyEventId);
  const storyPick = existing >= 0 ? picks.splice(existing, 1)[0]! : { eventId: storyEventId, reason: "Board games and free dumplings, right after your last class." };
  return { summary: output.summary, picks: [storyPick, ...picks].slice(0, CURATE_PICK_COUNT), storyPinned: true };
}

export async function curateFeed(
  events: CampusEvent[],
  storyEventId: string | null,
  now = new Date(),
  connectors: ConnectorSource[] = USER3_CONNECTORS,
): Promise<MuseJobResult<CuratedFeed>> {
  const candidates = curateCandidates(events, now);
  const ids = new Set(candidates.map((event) => event.id));
  const result = await runMuseJob({
    request: buildCurateRequest(candidates, connectors, now),
    outputSchema: CurateOutputSchema,
    fixture: () => curateFixture(candidates, connectors, storyEventId),
    accept: (output) => (output.picks.every((pick) => ids.has(pick.eventId)) ? null : "Muse picked an event that is not listed"),
  });
  if (result.data === null) return result;
  return { ...result, data: pinStory(result.data, storyEventId, candidates) };
}
