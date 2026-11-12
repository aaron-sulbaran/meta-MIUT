import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { askFixture } from "@/lib/muse/fixtures/ask";
import { runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// A sentence plus events to matching event ids and a one-line answer.

export const AskInputSchema = z.object({ question: z.string().trim().min(1).max(500) });

export const AskOutputSchema = z.object({
  answer: z.string().min(1),
  eventIds: z.array(z.string().min(1)).max(10),
});

export type AskInput = z.infer<typeof AskInputSchema>;
export type AskOutput = z.infer<typeof AskOutputSchema>;

export async function askAboutEvents(
  input: AskInput,
  events: CampusEvent[],
  now = new Date(),
): Promise<MuseJobResult<AskOutput>> {
  const knownIds = new Set(events.map((event) => event.id));
  const summaries = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    start: event.start,
    place: event.place.name,
    free: event.free,
    food: event.food,
  }));
  const result = await runMuseJob({
    request: {
      system:
        'Answer a student looking for campus events. Return JSON only: {"answer":"one short sentence","eventIds":["..."]}. Only use ids from the list. Empty list if nothing fits.',
      prompt: `Now: ${now.toISOString()}\nQuestion: ${input.question}\nEvents: ${JSON.stringify(summaries)}`,
    },
    outputSchema: AskOutputSchema,
    fixture: askFixture,
    accept: (output) => (output.eventIds.every((id) => knownIds.has(id)) ? null : "Muse returned an unknown event id"),
  });
  if (result.error !== null) return result;
  return { ...result, data: { ...result.data, eventIds: result.data.eventIds.filter((id) => knownIds.has(id)) } };
}
