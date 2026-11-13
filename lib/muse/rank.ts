import "server-only";
import { z } from "zod";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent, RankedPick } from "@/lib/events/schema";
import { isInWindow } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";
import { compileCandidates, eventText, eventTopics, scheduleClash } from "@/lib/muse/candidates";
import { rankFixture } from "@/lib/muse/fixtures/rank";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import { DEMO_USER_ID, getInterestMemory, type InterestMemory } from "@/lib/muse/memory";
import { minimumAge, origin, type StudentContext } from "@/lib/muse/profile";
import type { LikelyEvent } from "@/lib/muse/types";

// Student profile, interest memory, and events to the top 3 picks for today,
// plus every event this week they are likely to care about. Muse weighs every
// upcoming event against the student and rates how likely they are to go, which
// orders the For you list, and picks the Top 3 from today's;
// code only drops events they cannot attend and supplies the facts (walking
// time, class clashes, topics), never a score. The code-scored pool is only the
// recorded stand-in when Muse cannot answer.

const FIELD_SIZE = 60;

export const RankOutputSchema = z.object({
  ratings: z.array(z.object({ eventId: z.string().min(1), relevance: z.number().min(0).max(100) })).max(FIELD_SIZE).default([]),
  picks: z.array(z.object({ eventId: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
});

export type RankOutput = z.infer<typeof RankOutputSchema>;

// ratings: Muse's 0 to 100 relevance per upcoming event; empty when the recorded stand-in answered.
export type PersonalizedEvents = { picks: RankedPick[]; likely: LikelyEvent[]; ratings: Record<string, number> };

export const RANK_STRUCTURED_OUTPUT = museStructuredOutput("event_picks", RankOutputSchema);

const POOL_SIZE = 12;

// Every upcoming event the student can attend, soonest first. No scoring: Muse judges these.
function upcomingField(events: CampusEvent[], profile: StudentContext, now: Date): CampusEvent[] {
  return events
    .filter((event) => {
      if (event.status !== "published" || Date.parse(event.end) <= now.getTime()) return false;
      const ageLimit = minimumAge(eventText(event));
      return ageLimit === null || profile.age === undefined || profile.age >= ageLimit;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, FIELD_SIZE);
}

// Today's likely events without a class clash first, then the clashing ones,
// then anything else still on today so a new student still gets three picks.
function picksPool(likely: LikelyEvent[], events: CampusEvent[], profile: StudentContext, now: Date): LikelyEvent[] {
  const today = likely.filter((candidate) => candidate.today);
  const pool = [...today.filter((candidate) => !candidate.clash), ...today.filter((candidate) => candidate.clash)];
  const taken = new Set(pool.map((candidate) => candidate.eventId));
  const rest = events
    .filter((event) => event.status === "published" && !taken.has(event.id) && isInWindow(event, "today", now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((event): LikelyEvent => {
      const walk = walkMinutes(origin(profile), event.place);
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

/**
 * Likely events by time and interest: what is on now first, then day by day,
 * and within each, the best match first (soonest breaks ties).
 */
export function soonestFirst(likely: LikelyEvent[], events: CampusEvent[], now: Date): LikelyEvent[] {
  const startOf = new Map(events.map((event) => [event.id, Date.parse(event.start)]));
  const start = (candidate: LikelyEvent) => startOf.get(candidate.eventId) ?? Number.POSITIVE_INFINITY;
  const bucket = (candidate: LikelyEvent) => {
    const at = start(candidate);
    if (at <= now.getTime()) return "0";
    return Number.isFinite(at) ? `1${new Date(at).toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE })}` : "2";
  };
  return [...likely].sort(
    (a, b) => bucket(a).localeCompare(bucket(b)) || b.score - a.score || start(a) - start(b),
  );
}

/** "0" while on, else "1" plus the campus date, so buckets sort on now, then day by day. */
function timeBucket(start: number, now: Date): string {
  if (start <= now.getTime()) return "0";
  return `1${new Date(start).toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE })}`;
}

/**
 * For you under the Top 3: every upcoming event except `skip`, by time and
 * interest: on now first, then day by day; within each, the events the
 * student is likely to care about first (best match first), then the rest,
 * soonest first.
 */
export function forYouOrder(
  likely: LikelyEvent[],
  events: CampusEvent[],
  now: Date,
  skip: Set<string>,
  ratings: Record<string, number> = {},
): CampusEvent[] {
  // Muse's ratings when it answered; the code score only when it could not.
  const museRated = Object.keys(ratings).length > 0;
  const scores = museRated ? new Map(Object.entries(ratings)) : new Map(likely.map((candidate) => [candidate.eventId, candidate.score]));
  const score = (event: CampusEvent) => scores.get(event.id) ?? Number.NEGATIVE_INFINITY;
  return events
    .filter((event) => event.status === "published" && Date.parse(event.end) > now.getTime() && !skip.has(event.id))
    .sort(
      (a, b) =>
        timeBucket(Date.parse(a.start), now).localeCompare(timeBucket(Date.parse(b.start), now)) ||
        score(b) - score(a) ||
        Date.parse(a.start) - Date.parse(b.start),
    );
}

export async function personalizeEvents(
  profile: StudentContext,
  events: CampusEvent[],
  now = new Date(),
  memory: InterestMemory = getInterestMemory(DEMO_USER_ID, now),
): Promise<MuseJobResult<PersonalizedEvents>> {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const likely = compileCandidates(profile, memory, events, now);
  // The recorded stand-in when Muse cannot answer: the code-scored pool.
  const pool = picksPool(likely, events, profile, now);
  const field = upcomingField(events, profile, now);
  const todayIds = new Set(field.filter((event) => isInWindow(event, "today", now)).map((event) => event.id));
  const fieldIds = new Set(field.map((event) => event.id));
  const from = origin(profile);
  const follows = new Set(profile.follows);

  const candidates = field.map((event) => ({
    id: event.id,
    title: event.title,
    about: event.description.slice(0, 200),
    topics: eventTopics(event),
    today: todayIds.has(event.id),
    start: event.start,
    end: event.end,
    place: event.place.name,
    walkMinutes: walkMinutes(from, event.place),
    free: event.free,
    food: event.food ? (event.foodNote ?? true) : false,
    organizer: event.organizer.handle,
    followsOrganizer: follows.has(event.organizer.handle),
    clashesWith: scheduleClash(event, profile.schedule),
  }));
  const interestMemory = {
    topics: memory.topics.slice(0, 8).map(({ topic, score, evidence }) => ({ topic, score, evidence })),
    creators: memory.creators.slice(0, 5),
    skips: memory.avoided ?? [],
  };

  // Keep the same Top 3 until something real changes: a new candidate or one leaving
  // today's pool, the interest memory (hiding an event updates it), or a picked event ending.
  // The list and the map then always show one Top 3.
  const cacheKey = JSON.stringify([candidates.map((candidate) => candidate.id), interestMemory]);
  const cached = picksCache().get(cacheKey);
  const stillOn = (eventId: string) => {
    const event = eventsById.get(eventId);
    return event !== undefined && Date.parse(event.end) > now.getTime();
  };
  if (cached?.data && cached.data.picks.every((pick) => stillOn(pick.eventId))) return cached;

  const result = await runMuseJob({
    request: {
      system:
        'You are the student\'s event agent. Weigh every upcoming candidate event against this student and decide how likely they are to go: rate each one from 0 (not for them) to 100 (they would not miss it), then pick the 3 on today (today: true) they are most likely to go to. Return JSON only: {"ratings":[{"eventId":"...","relevance":0-100}],"picks":[{"eventId":"...","reason":"one short sentence"}]}. Rate every candidate once; picks are the 3 highest rated among those on today, best first. Use only ids from the candidates. The interest memory comes from how they use Instagram (videos they watch to the end, likes, comments, saves) and the events they marked interested, RSVPed to, went to, or dismissed. Weigh it most, events they went to above all. skips are topics they hid with Not for me: rate events on those topics low unless the student listed that interest. Then use what the student told us: age, class year, major, languages, communities they listed, diet, and the clubs they follow; then free, short walks from where they are now, and no clash with their classes. Never guess or use race, ethnicity, religion, or other protected traits. Each reason names the behavior or follow it comes from, in plain words.',
      prompt: `Now: ${now.toISOString()}\nStudent: ${JSON.stringify(profile)}\nInterest memory: ${JSON.stringify(interestMemory)}\nCandidates: ${JSON.stringify(candidates)}`,
      structuredOutput: RANK_STRUCTURED_OUTPUT,
    },
    outputSchema: RankOutputSchema,
    fixture: () => rankFixture(pool),
    accept: (output) => {
      const ids = output.picks.map((pick) => pick.eventId);
      if (!ids.every((id) => fieldIds.has(id))) return "Muse picked an event outside the candidates";
      if (!ids.every((id) => todayIds.has(id))) return "Muse picked an event that is not on today";
      if (!output.ratings.every((rating) => fieldIds.has(rating.eventId))) return "Muse rated an event outside the candidates";
      return new Set(ids).size === ids.length ? null : "Muse picked the same event twice";
    },
  });

  if (result.error !== null) return result;
  const relevance = new Map(result.data.ratings.map((rating) => [rating.eventId, rating.relevance]));
  const rated = (eventId: string) => relevance.get(eventId) ?? Number.NEGATIVE_INFINITY;
  const ordered = [...result.data.picks].sort((a, b) => rated(b.eventId) - rated(a.eventId));
  const picks = ordered.flatMap((pick) => {
    const event = eventsById.get(pick.eventId);
    return event ? [{ eventId: pick.eventId, reason: pick.reason, walkMinutes: walkMinutes(origin(profile), event.place) }] : [];
  });
  const personalized = { ...result, data: { picks, likely, ratings: Object.fromEntries(relevance) } };
  if (result.source === "muse") picksCache().set(cacheKey, personalized);
  return personalized;
}

type CachedPicks = MuseJobResult<PersonalizedEvents>;

// On globalThis, because Next dev compiles pages and route handlers as separate module graphs.
function picksCache(): Map<string, CachedPicks> {
  const scope = globalThis as typeof globalThis & { __musePicks?: Map<string, CachedPicks> };
  scope.__musePicks ??= new Map();
  if (scope.__musePicks.size > 50) scope.__musePicks.clear();
  return scope.__musePicks;
}

export type ForYouTile = { eventId: string; walkMinutes: number; reason: string | null };
export type ForYouFeed = { ranking: MuseJobResult<PersonalizedEvents>; tiles: ForYouTile[]; rest: CampusEvent[] };

/**
 * The one For you order the list and the map share: the Top 3 (Muse's picks
 * for today, filled from forYouOrder when Muse picks fewer), then every other
 * upcoming event in forYouOrder.
 */
export async function forYouFeed(
  profile: StudentContext,
  events: CampusEvent[],
  now: Date,
  memory: InterestMemory,
): Promise<ForYouFeed> {
  const ranking = await personalizeEvents(profile, events, now, memory);
  const picks = ranking.data?.picks ?? [];
  const pickedIds = new Set(picks.map((pick) => pick.eventId));
  const ordered = forYouOrder(compileCandidates(profile, memory, events, now, "upcoming"), events, now, pickedIds, ranking.data?.ratings);
  const fill = ordered.slice(0, Math.max(0, 3 - picks.length));
  const reasons = new Map((ranking.data?.likely ?? []).map((candidate) => [candidate.eventId, candidate.reason]));
  const tiles = [
    ...picks.map((pick) => ({ eventId: pick.eventId, walkMinutes: pick.walkMinutes, reason: pick.reason })),
    ...fill.map((event) => ({ eventId: event.id, walkMinutes: walkMinutes(profile.home, event.place), reason: reasons.get(event.id) ?? null })),
  ];
  return { ranking, tiles, rest: ordered.slice(fill.length) };
}

export async function rankEvents(
  profile: StudentContext,
  events: CampusEvent[],
  now = new Date(),
  memory?: InterestMemory,
): Promise<MuseJobResult<RankedPick[]>> {
  const result = await personalizeEvents(profile, events, now, memory);
  if (result.error !== null) return result;
  return { ...result, data: result.data.picks };
}
