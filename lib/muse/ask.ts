import "server-only";
import { z } from "zod";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine, isInWindow } from "@/lib/events/time";
import type { Turn } from "@/lib/muse/conversation";
import { askFixture } from "@/lib/muse/fixtures/ask";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import type { StudentContext } from "@/lib/muse/profile";
import { ASK_ACTIONS, FEED_FILTERS } from "@/lib/muse/types";

// A request in words (typed or spoken) to an answer, the events it is about,
// actions to carry out for the student, an optional follow-up question, and
// topics the request showed interest in.

export const AskInputSchema = z.object({ question: z.string().trim().min(1).max(500) });

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
  "You are Muse inside a campus events app. A student types or speaks a request; spoken requests are transcribed, so read past small transcription errors.",
  'Return JSON only: {"answer":"one or two short sentences, spoken aloud","eventIds":["..."],"actions":[{"type":"...","eventId":"... or null","filter":"... or null"}],"followUp":"a question or null","learnedTopics":["..."]}.',
  "eventIds: events your answer is about, best first, at most 5, only ids from the list. Name each event by its title in the answer.",
  'actions: do what the student asks. "rsvp" (they say they are going or want to RSVP), "cancel_rsvp", "interested" (save or mark interested), "open" (show one event), "filter" with filter one of forYou, free, today, week (show a list), "plan_night" (plan my night, a food crawl, a route home past free food), "create_event" with eventId null (they describe an event they are hosting or ask to post, create, or publish one; Muse drafts it for them to check and publish). Only act on events from the list, and only when the student asked; never RSVP on your own guess.',
  "followUp: if the request is vague or could mean several things (which event, what time, what kind) and you cannot make a confident prediction from the conversation, the student and what is on, ask one short question that offers two or three concrete choices, and do not RSVP, mark interested, plan or create yet. Keep asking on each turn until it is clear; once the student answers, combine the answer with their earlier request and carry it out. When you can make a good prediction of what they want, answer with it and set followUp to null. When you ask, the answer is a short lead-in that does not repeat the question.",
  "learnedTopics: lowercase interests the student showed in this request, for example climbing or free food; empty if none.",
  "Use the conversation so far for context. Use the student profile to predict what they mean and which events fit best; never mention it or why something suits them.",
].join(" ");

const WAITS_FOR_ANSWER = new Set(["rsvp", "cancel_rsvp", "interested", "plan_night", "create_event"]);

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
): Promise<MuseJobResult<AskOutput>> {
  const open = events.filter((event) => event.status === "published" && isInWindow(event, "week", now));
  const knownIds = new Set(open.map((event) => event.id));
  const about = student
    ? { interests: student.interests, year: student.year, major: student.major, dietary: student.dietary }
    : null;
  const summaries = open.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    when: formatDateLine(event, now),
    place: event.place.name,
    free: event.free,
    food: event.food,
  }));
  const said = history.map((turn) => `${turn.role === "student" ? "Student" : "Muse"}: ${turn.text}`).join("\n");
  const clock = now.toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, dateStyle: "full", timeStyle: "short" });
  const result = await runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `Now on campus: ${clock}\nStudent: ${JSON.stringify(about)}\nConversation so far:\n${said || "(none)"}\nRequest: ${input.question}\nEvents: ${JSON.stringify(summaries)}`,
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
