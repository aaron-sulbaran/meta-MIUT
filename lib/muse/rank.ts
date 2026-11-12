import "server-only";
import { z } from "zod";
import type { CampusEvent, RankedPick, StudentProfile } from "@/lib/events/schema";
import { isInWindow } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";
import { compileCandidates } from "@/lib/muse/candidates";
import { rankFixture } from "@/lib/muse/fixtures/rank";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import { DEMO_USER_ID, getInterestMemory, type InterestMemory } from "@/lib/muse/memory";
import type { LikelyEvent } from "@/lib/muse/types";

// Student profile, interest memory, and events to the top 3 picks for today,
// plus every event this week they are likely to care about. Candidates are
// scored here; Muse only chooses among them and words the reasons. Walking
// time is computed here, never taken from the model.

export const RankOutputSchema = z.object({
  picks: z.array(z.object({ eventId: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
});

export type RankOutput = z.infer<typeof RankOutputSchema>;

export type PersonalizedEvents = { picks: RankedPick[]; likely: LikelyEvent[] };

export const RANK_STRUCTURED_OUTPUT = museStructuredOutput("event_picks", RankOutputSchema);

const POOL_SIZE = 12;

// Today's likely events without a class clash first, then the clashing ones,
// then anything else still on today so a new student still gets three picks.
function picksPool(likely: LikelyEvent[], events: CampusEvent[], profile: StudentProfile, now: Date): LikelyEvent[] {
  const today = likely.filter((candidate) => candidate.today);
  const pool = [...today.filter((candidate) => !candidate.clash), ...today.filter((candidate) => candidate.clash)];
  const taken = new Set(pool.map((candidate) => candidate.eventId));
  const rest = events
    .filter((event) => event.status === "published" && !taken.has(event.id) && isInWindow(event, "today", now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((event): LikelyEvent => {
      const walk = walkMinutes(profile.home, event.place);
      return {
        eventId: event.id,
        score: 0,
        today: true,
        walkMinutes: walk,
        clash: null,
        matched: [],
        reason: event.free ? `Free today, ${walk} min away.` : `On today, ${walk} min away.`,
      };
    });
  return [...pool, ...rest].slice(0, POOL_SIZE);
}

export async function personalizeEvents(
  profile: StudentProfile,
  events: CampusEvent[],
  now = new Date(),
  memory: InterestMemory = getInterestMemory(DEMO_USER_ID, now),
): Promise<MuseJobResult<PersonalizedEvents>> {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const likely = compileCandidates(profile, memory, events, now);
  const pool = picksPool(likely, events, profile, now);
  const poolIds = new Set(pool.map((candidate) => candidate.eventId));

  const candidates = pool.flatMap((candidate) => {
    const event = eventsById.get(candidate.eventId);
    if (!event) return [];
    return [
      {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        place: event.place.name,
        walkMinutes: candidate.walkMinutes,
        free: event.free,
        food: event.food,
        organizer: event.organizer.handle,
        matched: candidate.matched,
        clashesWith: candidate.clash,
        score: candidate.score,
      },
    ];
  });
  const interestMemory = {
    topics: memory.topics.slice(0, 8).map(({ topic, score, evidence }) => ({ topic, score, evidence })),
    creators: memory.creators.slice(0, 5),
  };

  const result = await runMuseJob({
    request: {
      system:
        'Pick the 3 best events for this student today. Return JSON only: {"picks":[{"eventId":"...","reason":"one short sentence"}]}. Use only ids from the candidates. The interest memory comes from how they use Instagram: videos they watch to the end, likes, comments, saves. Weigh it most, then clubs they follow, free, short walks, and no clash with their classes. Each reason names the behavior or follow it comes from, in plain words.',
      prompt: `Now: ${now.toISOString()}\nStudent: ${JSON.stringify(profile)}\nInterest memory: ${JSON.stringify(interestMemory)}\nCandidates: ${JSON.stringify(candidates)}`,
      structuredOutput: RANK_STRUCTURED_OUTPUT,
    },
    outputSchema: RankOutputSchema,
    fixture: () => rankFixture(pool),
    accept: (output) => {
      const ids = output.picks.map((pick) => pick.eventId);
      if (!ids.every((id) => poolIds.has(id))) return "Muse picked an event outside the candidates";
      return new Set(ids).size === ids.length ? null : "Muse picked the same event twice";
    },
  });

  if (result.error !== null) return result;
  const picks = result.data.picks.flatMap((pick) => {
    const event = eventsById.get(pick.eventId);
    return event ? [{ eventId: pick.eventId, reason: pick.reason, walkMinutes: walkMinutes(profile.home, event.place) }] : [];
  });
  return { ...result, data: { picks, likely } };
}

export async function rankEvents(
  profile: StudentProfile,
  events: CampusEvent[],
  now = new Date(),
  memory?: InterestMemory,
): Promise<MuseJobResult<RankedPick[]>> {
  const result = await personalizeEvents(profile, events, now, memory);
  if (result.error !== null) return result;
  return { ...result, data: result.data.picks };
}
