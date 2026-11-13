import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { formatDateLine, isInWindow } from "@/lib/events/time";
import type { StudentContext } from "@/lib/muse/profile";
import { askFixture } from "@/lib/muse/fixtures/ask";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// A sentence plus events to matching event ids and a one-line answer.

export const AskInputSchema = z.object({ question: z.string().trim().min(1).max(500) });

export const AskOutputSchema = z.object({
  answer: z.string().min(1),
  eventIds: z.array(z.string().min(1)).max(10),
});

export type AskInput = z.infer<typeof AskInputSchema>;
export type AskOutput = z.infer<typeof AskOutputSchema>;

export const ASK_STRUCTURED_OUTPUT = museStructuredOutput("event_answer", AskOutputSchema);

export async function askAboutEvents(
  input: AskInput,
  events: CampusEvent[],
  now = new Date(),
  student?: StudentContext,
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
  const result = await runMuseJob({
    request: {
      system:
        'Answer a student looking for campus events. Return JSON only: {"answer":"one short sentence","eventIds":["..."]}. Only use ids from the list, best fit first, at most 5. Empty list if nothing fits. The question may be transcribed speech, so read past small transcription errors. Use the student profile only to break ties; never mention it.',
      prompt: `Now on campus: ${now.toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, dateStyle: "full", timeStyle: "short" })}\nStudent: ${JSON.stringify(about)}\nQuestion: ${input.question}\nEvents: ${JSON.stringify(summaries)}`,
      structuredOutput: ASK_STRUCTURED_OUTPUT,
    },
    outputSchema: AskOutputSchema,
    fixture: askFixture,
    accept: (output) => (output.eventIds.every((id) => knownIds.has(id)) ? null : "Muse returned an unknown event id"),
  });
  if (result.error !== null) return result;
  return { ...result, data: { ...result.data, eventIds: result.data.eventIds.filter((id) => knownIds.has(id)) } };
}
