import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent, ScheduleBlock } from "@/lib/events/schema";
import { isInWindow } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";
import type { InterestMemory } from "@/lib/muse/memory";
import { minimumAge, origin, studyTopics, type StudentContext } from "@/lib/muse/profile";
import type { LikelyEvent } from "@/lib/muse/types";

// Every event this week the student is likely to care about, scored from
// their interest memory, stated interests, major and year, the communities and
// languages they listed, follows, diet, distance, age limits, and schedule.
// Rank sends the best of these to Muse; the UI shows the rest.

export const MAX_WALK_MINUTES = 20; // about one mile

// Topics are matched by keyword in an event's text. Memory and stated
// interests use the same topic names.
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "rock climbing": ["climb", "boulder"],
  fitness: ["climb", "boulder", "workout", "run club"],
  yoga: ["yoga"],
  wellness: ["yoga", "meditation", "wellness"],
  hackathons: ["hack", "build night", "soldering"],
  coding: ["acm", "coding", "programming", "hack", "computer science"],
  film: ["film", "screening", "movie"],
  music: ["concert", "orchestra", "music", "band"],
  careers: ["resume", "career", "recruiter", "internship"],
  studying: ["study", "tutor"],
  "free food": [],
};

export function eventText(event: CampusEvent): string {
  return `${event.title} ${event.description} ${event.foodNote ?? ""} ${event.organizer.name}`.toLowerCase();
}

export function eventTopics(event: CampusEvent): string[] {
  const text = eventText(event);
  const topics = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([topic]) => topic);
  if (event.free && event.food) topics.push("free food");
  return topics;
}

function campusClock(date: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  return { weekday, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

const clockMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** The label of the first class the event overlaps, or null. */
export function scheduleClash(event: CampusEvent, schedule: ScheduleBlock[]): string | null {
  const start = campusClock(new Date(event.start));
  const end = campusClock(new Date(event.end));
  const endMinutes = end.weekday === start.weekday ? end.minutes : 24 * 60;
  const block = schedule.find(
    (item) =>
      item.weekday === start.weekday &&
      start.minutes < clockMinutes(item.endTime) &&
      endMinutes > clockMinutes(item.startTime),
  );
  return block?.label ?? null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function reasonFor(
  event: CampusEvent,
  options: {
    hook: string | null;
    foodHook: string | null;
    followsClub: boolean;
    matched: string[];
    walk: number;
    clash: string | null;
  },
): string {
  const { hook, foodHook, followsClub, matched, walk, clash } = options;
  if (!hook && !followsClub && foodHook) {
    return clash ? `${capitalize(foodHook)}, but it overlaps ${clash}.` : `Free food ${walk} min away, and ${foodHook}.`;
  }
  const why = hook
    ? capitalize(hook) + (followsClub ? ` and follow ${event.organizer.name}` : "")
    : followsClub
      ? `You follow ${event.organizer.name}`
      : `Matches your interest in ${matched[0]}`;
  if (clash) return `${why}, but it overlaps ${clash}.`;
  if (event.free && event.food) return `${why}, with free food ${walk} min away.`;
  if (event.free) return `${why}, free and ${walk} min away.`;
  return `${why}, ${walk} min away.`;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function compileCandidates(
  profile: StudentContext,
  memory: InterestMemory,
  events: CampusEvent[],
  now: Date,
): LikelyEvent[] {
  const remembered = new Map(memory.topics.map((topic) => [topic.topic, topic]));
  const creators = new Map(memory.creators.map((creator) => [creator.handle, creator.score]));
  const stated = new Set(profile.interests.map((interest) => interest.toLowerCase()));
  const follows = new Set(profile.follows);
  const fromStudies = new Set(studyTopics(profile));
  // Self-declared only: a community or language counts when the event names it.
  const affinities = [...(profile.communities ?? []), ...(profile.languages ?? [])].map((item) => item.toLowerCase());
  const diets = (profile.dietary ?? []).map((item) => item.toLowerCase());
  const avoided = new Set(memory.avoided ?? []);
  const from = origin(profile);

  return events
    .filter((event) => event.status === "published" && isInWindow(event, "week", now))
    .flatMap((event) => {
      const text = eventText(event);
      const ageLimit = minimumAge(text);
      if (ageLimit !== null && profile.age !== undefined && profile.age < ageLimit) return [];

      const matched: string[] = [];
      let interest = 0;
      // Free food is a fact about the event; prefer a more specific topic for the reason.
      let hook: string | null = null;
      let strongest = 0;
      let foodHook: string | null = null;
      const topics = eventTopics(event);
      for (const topic of topics) {
        const memo = remembered.get(topic);
        const score = (memo?.score ?? 0) + (stated.has(topic) ? 0.5 : 0) + (fromStudies.has(topic) ? 0.3 : 0);
        if (score <= 0) continue;
        matched.push(topic);
        interest += score;
        if (memo && topic === "free food") foodHook = memo.hook;
        else if (memo && memo.score > strongest) {
          strongest = memo.score;
          hook = memo.hook;
        }
      }
      // Something they skip, with nothing they like about it: leave it out.
      if (interest <= 0 && topics.some((topic) => avoided.has(topic) && !stated.has(topic))) return [];
      for (const affinity of affinities) {
        if (!text.includes(affinity)) continue;
        matched.push(affinity);
        interest += 0.8;
      }
      if (event.food) {
        for (const diet of diets) {
          if (!(event.foodNote ?? "").toLowerCase().includes(diet)) continue;
          matched.push(diet);
          interest += 0.2;
        }
      }
      const followsClub = follows.has(event.organizer.handle);
      const creatorAffinity = creators.get(event.organizer.handle) ?? 0;
      const personal = Math.min(interest, 1.5) + (followsClub ? 0.8 : 0) + creatorAffinity * 0.5;
      if (personal <= 0) return [];

      const walk = walkMinutes(from, event.place);
      const clash = scheduleClash(event, profile.schedule);
      const today = isInWindow(event, "today", now);
      const nearby = walk <= MAX_WALK_MINUTES ? 0.3 * (1 - walk / MAX_WALK_MINUTES) : -0.5;
      const score = personal + (event.free ? 0.3 : 0) + (today ? 0.3 : 0) + nearby - (clash ? 0.8 : 0);

      const likely: LikelyEvent = {
        eventId: event.id,
        score: round2(score),
        today,
        walkMinutes: walk,
        clash,
        matched: followsClub ? [...matched, `@${event.organizer.handle}`] : matched,
        reason: reasonFor(event, { hook, foodHook, followsClub, matched, walk, clash }),
      };
      return [likely];
    })
    .sort((a, b) => b.score - a.score || a.eventId.localeCompare(b.eventId));
}
