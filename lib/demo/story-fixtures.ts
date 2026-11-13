import { CAST } from "@/lib/demo/beats";
import { demoClock } from "@/lib/demo/clock";
import { STORY, STORY_ORGANIZER } from "@/lib/demo/story-data";
import { storyCaption, storyTimeLine, storyTimes } from "@/lib/demo/staged";
import type { CampusEvent } from "@/lib/events/schema";
import type { AskOutput } from "@/lib/muse/ask";
import type { CrawlInput, CrawlPick } from "@/lib/muse/crawl";
import type { ExtractOutput } from "@/lib/muse/extract";
import { EVERYONE } from "@/lib/social/fixtures/people";
import { ownReason, type WhoIsGoing } from "@/lib/social/types";

// Recorded answers for the demo's own story, used only when Muse falls back on
// the demo path (the story's flyer, the re-plan to Lisa). They tell the same
// story as a live run: Board Game Night by the MIT Board Game Club at the MIT
// Museum on the demo clock, free dumplings, Jolyn inviting Lisa. Built from
// story-data and the cast, never typed twice. Every other request keeps the
// generic fixtures, and every one of these still comes back as source "fixture",
// so the screens say "Recorded".

const PLACE = "MIT Museum";

/** True for the story's own Instagram caption (the organizer handoff). */
export function isStoryCaption(caption: string): boolean {
  const text = caption.toLowerCase();
  return text.includes(STORY.title.toLowerCase()) && text.includes(PLACE.toLowerCase());
}

/** The story's draft, as Muse reads it from the flyer and caption, on the demo clock. */
export function storyExtractFixture(caption: string, now = demoClock()): ExtractOutput {
  const { start, end } = storyTimes(now);
  const timeLine = storyTimeLine(now);
  // Quotes must be words from the caption, or the draft's grounding check lowers them.
  const quote = (words: string) => (caption.toLowerCase().includes(words.toLowerCase()) ? { quote: words, from: "caption" as const } : { quote: words, from: "image" as const });
  return {
    title: STORY.title,
    description: STORY.description,
    start: start.toISOString(),
    end: end.toISOString(),
    placeName: STORY.placeName,
    free: true,
    food: true,
    foodNote: `Free ${STORY.foodNote.toLowerCase()} while they last`,
    access: { kind: "open" },
    confidence: { title: 0.95, description: 0.85, start: 0.9, end: 0.9, place: 0.92, free: 0.95, food: 0.96, access: 0.85 },
    evidence: {
      title: quote(STORY.title),
      start: quote(timeLine),
      end: quote(timeLine),
      place: quote(PLACE),
      free: quote(`free ${STORY.foodNote.toLowerCase()}`),
      food: quote(`free ${STORY.foodNote.toLowerCase()} while they last`),
      access: quote("Open to everyone"),
    },
  };
}

/**
 * The story's times are printed on its flyer and caption ("3:30 to 5:30 PM", on
 * the demo clock). A live read that lands anywhere else (a misread, or "now"
 * taken as the start) gets the printed times back, quoted from the caption, so
 * the posted event and every screen after it say the same thing. Only when the
 * caption carries this clock's time line; other posts and clocks pass through.
 */
export function withStoryTimes<Draft extends Pick<ExtractOutput, "start" | "end" | "evidence">>(draft: Draft, caption: string, now = demoClock()): Draft {
  if (!isStoryCaption(caption)) return draft;
  const timeLine = storyTimeLine(now);
  if (!caption.includes(timeLine)) return draft;
  const { start, end } = storyTimes(now);
  if (Date.parse(draft.start) === start.getTime() && Date.parse(draft.end) === end.getTime()) return draft;
  const quote = { quote: timeLine, from: "caption" as const };
  return { ...draft, start: start.toISOString(), end: end.toISOString(), evidence: { ...draft.evidence, start: quote, end: quote } };
}

/** The story event among the listed ones: the club's newest. */
export function findStoryEvent(events: CampusEvent[]): CampusEvent | undefined {
  return events
    .filter((event) => event.organizer.handle.toLowerCase() === STORY_ORGANIZER.handle)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
}

/** What User 1's Muse sends User 2 for the story event. */
export function storyInviteMessage(): string {
  return `Hi ${CAST.user2.name}! Want to come to ${STORY.title} at the ${PLACE} with me? 40 board games, and the ${STORY.foodNote.toLowerCase()} go fast.`;
}

/**
 * The story's title is fixed for the pitch ("Board Game Night + Free Dumplings").
 * A live Muse read of the story's caption that names it another way ("Board Game
 * Night", "Board Game Night with Free Dumplings") gets the story's title, grounded
 * in the caption, so every later screen shows the same words. Other posts pass through.
 */
export function withStoryTitle<Draft extends Pick<ExtractOutput, "title" | "evidence">>(draft: Draft, caption: string): Draft {
  if (!isStoryCaption(caption) || draft.title === STORY.title) return draft;
  if (!/board\s*game/i.test(draft.title)) return draft;
  return { ...draft, title: STORY.title, evidence: { ...draft.evidence, title: { quote: STORY.title, from: "caption" } } };
}

const names = (text: string, name: string) => new RegExp(`\\b${name}\\b`, "i").test(text);

/**
 * The re-plan line ("find an event closer to both of us and send Lisa the invite"):
 * the story event, between User 1 and User 2, with the walk and the invite.
 */
export function storyAskFixture(question: string, events: CampusEvent[]): AskOutput | null {
  if (!names(question, CAST.user2.name) || !/\binvite\b/i.test(question)) return null;
  const story = findStoryEvent(events);
  if (!story) return null;
  return {
    answer: `${STORY.title} at the ${PLACE} is between you and ${CAST.user2.name}. I'm sending ${CAST.user2.name} the invite.`,
    eventIds: [story.id],
    actions: [
      { type: "plan_night", eventId: story.id, filter: null },
      { type: "invite_friend", eventId: story.id, filter: null },
    ],
    followUp: null,
    learnedTopics: [],
  };
}

/** The walk toward the story event: it is a stop, and the invite is for it. */
export function storyCrawlFixture(generic: CrawlPick, candidates: CampusEvent[], input: CrawlInput): CrawlPick | null {
  if (!input.note || !input.note.toLowerCase().includes(STORY.title.toLowerCase())) return null;
  const story = findStoryEvent(candidates);
  if (!story) return null;
  const stops = generic.stops.some((stop) => stop.eventId === story.id)
    ? generic.stops
    : [...generic.stops.slice(0, 3), { eventId: story.id, kind: "event" as const }];
  return {
    stops,
    pitch: `Out of class? A free stop on the way, then ${STORY.title} with ${CAST.user2.name}.`,
    invite: { eventId: story.id, message: storyInviteMessage() },
  };
}

/** The story's caption on the demo clock, for tests and checks. */
export function storyCaptionNow(): string {
  return storyCaption(demoClock());
}

type CompanyPick = { line: string; people: { id: string; why: string }[] };

/**
 * The story's ending: a viewer with no friends going is offered exactly the people the
 * page lists as open to company there (Jolyn, and Lisa once she joined; lib/social/going.ts).
 * A live answer that leaves one out, or whose line names anyone else, gets a line and
 * picks built from that list, keeping Muse's reasons where it gave them. Other events,
 * and viewers with friends going, pass through.
 */
export function withStoryCompany<Pick extends CompanyPick>(pick: Pick, event: CampusEvent, who: WhoIsGoing): Pick {
  if (event.organizer.handle.toLowerCase() !== STORY_ORGANIZER.handle) return pick;
  if (who.friends.length > 0 || who.openToCompany.length === 0) return pick;
  const company = who.openToCompany;
  const ids = new Set(company.map((person) => person.id));
  const pickedIds = new Set(pick.people.map((person) => person.id));
  const sameIds = pickedIds.size === ids.size && [...pickedIds].every((id) => ids.has(id));
  const strangers = EVERYONE.filter((person) => !ids.has(person.id) && names(pick.line, person.name));
  const everyoneNamed = company.every((person) => names(pick.line, person.name));
  if (sameIds && strangers.length === 0 && everyoneNamed) return pick;
  const why = new Map(pick.people.map((person) => [person.id, person.why]));
  const people = company.map((person) => ({ id: person.id, why: why.get(person.id) ?? ownReason(person, company) }));
  // Muse's own words stay when they already name just these people.
  if (strangers.length === 0 && everyoneNamed) return { ...pick, people };
  const list = company.map((person) => person.name);
  const joined = list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
  const line = `${joined} ${company.length > 1 ? "are" : "is"} going and looking for company. Say hi!`;
  console.info(`[story company] Muse named ${JSON.stringify(pick.people.map((person) => person.id))} in "${pick.line}"; showing ${joined}`);
  return { ...pick, line, people };
}

