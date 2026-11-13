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

const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Upcoming published events worth curating: not over, within the next week, one per
 * title (a repost or a second copy of the same event is listed once; the story's copy wins).
 */
export function curateCandidates(events: CampusEvent[], now: Date, storyEventId: string | null = null): CampusEvent[] {
  const horizon = now.getTime() + CANDIDATE_WINDOW_DAYS * DAY_MS;
  const upcoming = events
    .filter((event) => event.status === "published" && Date.parse(event.end) > now.getTime() && Date.parse(event.start) < horizon)
    .sort((first, second) => Number(second.id === storyEventId) - Number(first.id === storyEventId) || Date.parse(first.start) - Date.parse(second.start));
  const seen = new Set<string>();
  return upcoming
    .filter((event) => {
      const key = titleKey(event.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => Date.parse(first.start) - Date.parse(second.start));
}

/** Picks with no event, title or kind of night twice (sameKindOfNight), topped up from `fallback` to the pick count when Muse gave fewer. */
export function distinctPicks(picks: CuratedPick[], events: CampusEvent[], fallback: CuratedPick[] = []): CuratedPick[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const keptTitles: string[] = [];
  const kept: CuratedPick[] = [];
  for (const pick of [...picks, ...fallback]) {
    const event = byId.get(pick.eventId);
    if (!event) continue;
    if (keptTitles.some((title) => titleKey(title) === titleKey(event.title) || sameKindOfNight(title, event.title))) continue;
    keptTitles.push(event.title);
    kept.push(pick);
    if (kept.length === CURATE_PICK_COUNT) break;
  }
  return kept;
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
      "Make the picks three different kinds of night, never two of the same thing (two food giveaways, two copies of one event).",
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
const PLAIN_WORDS = new Set(["night", "free", "today", "tonight", "with", "open"]);
const titleWords = (title: string, minLength: number) =>
  new Set((title.toLowerCase().match(WORD) ?? []).filter((word) => word.length >= minLength && !PLAIN_WORDS.has(word)).map((word) => word.replace(/s$/, "")));

/**
 * True when two titles name the same kind of night: one's words are all in the other's
 * ("Board Game Night" and "Board Game Night + Free Dumplings"), or they share a long word
 * ("Free Dumplings in Stata" and "Dumpling Night"). Keeps the recorded Top 3 three different nights.
 */
export function sameKindOfNight(first: string, second: string): boolean {
  const a = titleWords(first, 4);
  const b = titleWords(second, 4);
  const within = (small: Set<string>, big: Set<string>) => small.size > 0 && [...small].every((word) => big.has(word));
  if (within(a, b) || within(b, a)) return true;
  const longB = titleWords(second, 6);
  return [...titleWords(first, 6)].some((word) => longB.has(word));
}

// The story's recorded picks after its own night: what a live Muse call answered in rehearsal
// (2026-11-13), used whenever these seed events are listed, so a recorded run tells the same story.
const RECORDED_PICKS: CuratedPick[] = [
  { eventId: "evt-test-now-walker-boardgames", reason: "You liked six board game posts and finish strategy reels." },
  { eventId: "evt-test-now-sidney-film", reason: "You follow @mit_film and got its November screening list." },
];
const RECORDED_STORY_REASON = "You follow @mit_boardgames; its newsletter promised game nights with dumplings.";
const RECORDED_SUMMARY = "You like board games, late-night food, and film, and you are free after class.";

/** Without Muse: the story's recorded picks when listed, else events whose words overlap the signals most, story event first. */
export function curateFixture(events: CampusEvent[], connectors: ConnectorSource[], storyEventId: string | null): CurateOutput {
  const listed = new Set(events.map((event) => event.id));
  if (storyEventId && listed.has(storyEventId) && RECORDED_PICKS.every((pick) => listed.has(pick.eventId))) {
    return { summary: RECORDED_SUMMARY, picks: [{ eventId: storyEventId, reason: RECORDED_STORY_REASON }, ...RECORDED_PICKS] };
  }
  const signalWords = new Set(connectors.flatMap((source) => source.items.join(" ").toLowerCase().match(WORD) ?? []).filter((word) => word.length > 3));
  const scored = events
    .map((event) => {
      const words = `${event.title} ${event.description} ${event.foodNote ?? ""}`.toLowerCase().match(WORD) ?? [];
      // A signal word in the title counts three times: it is what the night is.
      const titleHits = (event.title.toLowerCase().match(WORD) ?? []).filter((word) => signalWords.has(word)).length;
      return { event, score: words.filter((word) => signalWords.has(word)).length + 2 * titleHits + (event.id === storyEventId ? 100 : 0) };
    })
    .sort((first, second) => second.score - first.score);
  // Three different nights, not three of the same: skip an event whose title repeats a
  // long word of one already picked (a second "Dumpling" night), unless nothing else is left.
  const picked: typeof scored = [];
  for (const candidate of scored) {
    if (picked.length === CURATE_PICK_COUNT) break;
    if (picked.some((pick) => sameKindOfNight(pick.event.title, candidate.event.title))) continue;
    picked.push(candidate);
  }
  for (const candidate of scored) {
    if (picked.length === CURATE_PICK_COUNT) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return {
    summary: RECORDED_SUMMARY,
    picks: picked.map(({ event }) => ({
      eventId: event.id,
      reason: event.food ? `Free ${event.foodNote?.toLowerCase() ?? "food"}, and it matches what you follow.` : "Matches what you follow and watch.",
    })),
  };
}

/** Puts the story event first when it is listed, keeping Muse's reason if it gave one. */
export function pinStory(output: CurateOutput, storyEventId: string | null, events: CampusEvent[]): CuratedFeed {
  const picks = distinctPicks(output.picks, events);
  if (!storyEventId || !events.some((event) => event.id === storyEventId) || picks[0]?.eventId === storyEventId) {
    return { summary: output.summary, picks, storyPinned: false };
  }
  const existing = picks.findIndex((pick) => pick.eventId === storyEventId);
  const storyPick = existing >= 0 ? picks.splice(existing, 1)[0]! : { eventId: storyEventId, reason: "Board games and free dumplings, right after your last class." };
  return { summary: output.summary, picks: distinctPicks([storyPick, ...picks], events), storyPinned: true };
}

/** The recorded feed, story first, labeled as a fixture: for when the curate call throws. */
export function curateFixtureFeed(
  events: CampusEvent[],
  storyEventId: string | null,
  now = new Date(),
  reason = "Curate failed",
  connectors: ConnectorSource[] = USER3_CONNECTORS,
): MuseJobResult<CuratedFeed> {
  const candidates = curateCandidates(events, now, storyEventId);
  return { data: pinStory(curateFixture(candidates, connectors, storyEventId), storyEventId, candidates), error: null, source: "fixture", fallbackReason: reason };
}

export async function curateFeed(
  events: CampusEvent[],
  storyEventId: string | null,
  now = new Date(),
  connectors: ConnectorSource[] = USER3_CONNECTORS,
): Promise<MuseJobResult<CuratedFeed>> {
  const candidates = curateCandidates(events, now, storyEventId);
  const ids = new Set(candidates.map((event) => event.id));
  const result = await runMuseJob({
    request: buildCurateRequest(candidates, connectors, now),
    outputSchema: CurateOutputSchema,
    fixture: () => curateFixture(candidates, connectors, storyEventId),
    accept: (output) => (output.picks.every((pick) => ids.has(pick.eventId)) ? null : "Muse picked an event that is not listed"),
  });
  if (result.data === null) return result;
  // Fewer than three distinct picks from Muse: the plain topic match fills the row.
  const topUp = result.source === "muse" ? curateFixture(candidates, connectors, storyEventId).picks : [];
  const filled = { ...result.data, picks: distinctPicks(result.data.picks, candidates, topUp) };
  return { ...result, data: pinStory(filled, storyEventId, candidates) };
}
