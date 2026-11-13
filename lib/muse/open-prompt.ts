import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { openPromptFixture } from "@/lib/muse/fixtures/open-prompt";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// The one-tap question an organizer gets near the end of a limited-spot event:
// "Still have pizza left? Open it to everyone?" Muse picks what is likely left over.

export const OPEN_PROMPT_LEAD_MINUTES = 30;

export const OpenPromptInputSchema = z.object({ eventId: z.string().min(1) });

export const OpenPromptOutputSchema = z.object({
  leftover: z.enum(["food", "merch", "seats", "other"]),
  question: z.string().min(1).max(120),
});

export type OpenPromptOutput = z.infer<typeof OpenPromptOutputSchema>;
export type OpenPrompt = OpenPromptOutput & { askAt: string };

export const OPEN_PROMPT_STRUCTURED_OUTPUT = museStructuredOutput("open_prompt", OpenPromptOutputSchema);

export function openPromptAskAt(event: CampusEvent): string {
  return new Date(Date.parse(event.end) - OPEN_PROMPT_LEAD_MINUTES * 60_000).toISOString();
}

export async function draftOpenPrompt(event: CampusEvent): Promise<MuseJobResult<OpenPrompt>> {
  const summary = {
    title: event.title,
    description: event.description,
    food: event.food,
    foodNote: event.foodNote,
    access: event.access,
  };
  const result = await runMuseJob({
    request: {
      system: [
        "An organizer's campus event ends in 30 minutes and had limited spots.",
        "Write the one question their phone shows: is there something left that students could still get, and should it open to everyone.",
        'Return JSON only: {"leftover": "food", "merch", "seats", or "other", "question": one short friendly line under 90 characters}.',
        "Name the actual thing when you can, for example the food. Plain words, no emoji.",
      ].join(" "),
      prompt: `Event: ${JSON.stringify(summary)}`,
      structuredOutput: OPEN_PROMPT_STRUCTURED_OUTPUT,
    },
    outputSchema: OpenPromptOutputSchema,
    fixture: () => openPromptFixture(event),
  });
  if (result.data === null) return result;
  return { ...result, data: { ...result.data, askAt: openPromptAskAt(event) } };
}
