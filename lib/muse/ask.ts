import "server-only";
import { z } from "zod";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, isInWindow } from "@/lib/events/time";
import type { Turn } from "@/lib/muse/conversation";
import type { InterestMemory } from "@/lib/muse/memory";
import type { SocialContext } from "@/lib/social/muse-friends";
import { askFixture } from "@/lib/muse/fixtures/ask";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import type { StudentContext } from "@/lib/muse/profile";
import { ASK_ACTIONS, FEED_FILTERS, type LikelyEvent } from "@/lib/muse/types";

// A request in words (typed or spoken) to an answer, the events it is about,
// actions to carry out for the student, an optional follow-up question, and
// topics the request showed interest in.

export const AskInputSchema = z.object({ question: z.string().trim().min(1).max(500), fresh: z.boolean().optional() });

export const AskActionSchema = z.object({
  type: z.enum(ASK_ACTIONS),
  eventId: z.string().min(1).nullable(),
  filter: z.enum(FEED_FILTERS).nullable(),
});

export const AskOutputSchema = z.object({
  answer: z.string().min(1),
  eventIds: z.array(z.string().min(1)).max(10),
  actions: z.array(AskActionSchema).max(3),
  followUp: z.string().min(1).nullable(),
  learnedTopics: z.array(z.string().trim().toLowerCase().min(1)).max(5),
});

export type AskInput = z.infer<typeof AskInputSchema>;
export type AskOutput = z.infer<typeof AskOutputSchema>;

export const ASK_STRUCTURED_OUTPUT = museStructuredOutput("event_answer", AskOutputSchema);

const SYSTEM = [
  "You are Muse inside a campus events app, the student's personal guide to what's on. A student types or speaks a request; spoken requests are transcribed, so read past small transcription errors.",
  "Each turn, work out what this student wants and give them everything that gets them there: the right events for them, the actions they asked for, and the next useful step.",
  'Return JSON only: {"answer":"one or two short sentences, spoken aloud, so talk like a friend: casual, warm, contractions, no lists or symbols","eventIds":["..."],"actions":[{"type":"...","eventId":"... or null","filter":"... or null"}],"followUp":"a question or null","learnedTopics":["..."]}.',
  "eventIds: events your answer is about, best first, at most 5, only ids from the list. Name each event by its title in the answer.",
  'actions: do what the student asks. "rsvp" (they say they are going or want to RSVP), "cancel_rsvp", "interested" (save or mark interested), "open" (show one event), "filter" with filter one of forYou, free, today, week (show a list), "plan_night" (anything about a path, route, walk or directions: plan my night, a food crawl or anything that implies one (hungry on the way, snacks or free food along a walk), a route home past free food, how to get to an event, with eventId set to that event, else null), "create_event" with eventId null (they describe an event they are hosting or ask to post, create, or publish one; Muse drafts it for them to check and publish), "invite_friend" (they ask to send, invite, or tell a friend about an event: eventId that event, or null together with plan_night when the walk picks it; the app sends the invite to the friend they named). Only act on events from the list, and only when the student asked; never RSVP on your own guess.',
  "A food crawl never needs a follow-up: return plan_night with followUp null, and the app plans the walk (home when the request names no end) and opens it. ","followUp: if the request is vague or could mean several things (which event, what time, what kind) and you cannot make a confident prediction from the conversation, the student and what is on, ask one short question that offers two or three concrete choices, and do not RSVP, mark interested, plan or create yet. Keep asking on each turn until it is clear; once the student answers, combine the answer with their earlier request and carry it out. When you can make a good prediction of what they want, answer with it and set followUp to null. When you ask, the answer is a short lead-in that does not repeat the question.",
  "learnedTopics: lowercase interests the student showed in this request, for example climbing or free food; empty if none.",
  "Personalize: you know the student (profile, interests they listed, clubs they follow, what they have been into lately, topics they skip, events they acted on) and each event's match for them (higher is a better fit, matched lists what fits). Choose and order events by that fit and by when they are; never offer events on topics they skip unless they ask.",
  'Why: when the student asks why, asks what you recommend, or asks if they would like something, say in one or two sentences why they in particular would enjoy it, tied to what they like (for example "you are into climbing and film, and it is a short walk from your place"), not a summary of the event. Do not volunteer reasons otherwise.',
  "Friends: you know the student's friends, what they like in common and which events they are going to. Use that when it helps (who to go with, an event a friend is going to). If the student has no friends listed, or asks to meet people or find someone to go with, suggest one to three people from suggestions by first name with what they have in common, and the events where they are open to company; tell the student to mark Going and Open to company there so they can say hi. Never share anything about people beyond what is listed.",
  "Conversation: continue the thread. Resolve it, that one, why, and later from the conversation so far, and build on what the student already told you instead of starting over.",
  "Safety: never say or imply that you watch what they view, like, save or comment on, and never quote that activity; talk about their interests instead. Never guess or mention ethnicity, race, religion, health, sexuality or other sensitive traits; use communities and languages only as the student listed them. Respect age limits such as 21+, and be honest about cost and distance.",
].join(" ");

const WAITS_FOR_ANSWER = new Set(["rsvp", "cancel_rsvp", "interested", "plan_night", "create_event", "invite_friend"]);

/** While Muse is still asking, it only shows things (open, filter); it changes nothing for the student. */
export function holdActionsWhileAsking(output: AskOutput): AskOutput {
  if (output.followUp === null) return output;
  return { ...output, actions: output.actions.filter((action) => !WAITS_FOR_ANSWER.has(action.type)) };
}

export function rejectUnknownIds(output: AskOutput, knownIds: Set<string>): string | null {
  const ids = [...output.eventIds, ...output.actions.flatMap((action) => (action.eventId ? [action.eventId] : []))];
  return ids.every((id) => knownIds.has(id)) ? null : "Muse returned an unknown event id";
}

export async function askAboutEvents(
  input: AskInput,
  events: CampusEvent[],
  now = new Date(),
  student?: StudentContext,
  history: Turn[] = [],
  memory?: InterestMemory,
  likely: LikelyEvent[] = [],
  social?: SocialContext,
): Promise<MuseJobResult<AskOutput>> {
  const open = events.filter((event) => event.status === "published" && isInWindow(event, "week", now));
  const knownIds = new Set(open.map((event) => event.id));
  const about = student
    ? {
        firstName: student.name.split(" ")[0],
        age: student.age,
        year: student.year,
        major: student.major,
        minor: student.minor,
        listedInterests: student.interests,
        languages: student.languages,
        communities: student.communities,
        dietary: student.dietary,
        follows: student.follows,
        intoLately: memory?.topics.slice(0, 8).map((topic) => topic.topic),
        skips: memory?.avoided,
      }
    : null;
  const fit = new Map(likely.map((candidate) => [candidate.eventId, candidate]));
  const summaries = open.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    when: formatDateLine(event, now),
    place: event.place.name,
    free: event.free,
    food: event.food,
    match: fit.has(event.id)
      ? { score: Math.round(fit.get(event.id)!.score * 10) / 10, matched: fit.get(event.id)!.matched, walkMinutes: fit.get(event.id)!.walkMinutes, clash: fit.get(event.id)!.clash }
      : null,
  }));
  const said = history.map((turn) => `${turn.role === "student" ? "Student" : "Muse"}: ${turn.text}`).join("\n");
  const clock = now.toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, dateStyle: "full", timeStyle: "short" });
  const result = await runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `Now on campus: ${clock}\nStudent (private, never quote): ${JSON.stringify(about)}\nFriends and people: ${JSON.stringify(social ?? null)}\nConversation so far:\n${said || "(none)"}\nRequest: ${input.question}\nEvents: ${JSON.stringify(summaries)}`,
      structuredOutput: ASK_STRUCTURED_OUTPUT,
    },
    outputSchema: AskOutputSchema,
    fixture: askFixture,
    accept: (output) => rejectUnknownIds(output, knownIds),
  });
  if (result.error !== null) return result;
  const known = (id: string | null) => id === null || knownIds.has(id);
  return {
    ...result,
    data: holdActionsWhileAsking({
      ...result.data,
      eventIds: result.data.eventIds.filter((id) => knownIds.has(id)),
      actions: result.data.actions.filter((action) => known(action.eventId)),
    }),
  };
}
