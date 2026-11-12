import "server-only";
import { z } from "zod";
import { CAMPUS_NAME, CAMPUS_TIME_ZONE } from "@/lib/brand";
import { AccessSchema, ConfidenceSchema } from "@/lib/events/schema";
import { extractFixture } from "@/lib/muse/fixtures/extract";
import { runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Flyer image plus caption to an event draft with per-field confidence.
// Coordinates are not asked of the model; the organizer flow resolves the place.

export const ExtractInputSchema = z.object({
  caption: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
  imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
});

export const ExtractOutputSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  placeName: z.string().min(1),
  free: z.boolean(),
  food: z.boolean(),
  foodNote: z.string().optional(),
  access: AccessSchema,
  confidence: ConfidenceSchema,
});

export type ExtractInput = z.infer<typeof ExtractInputSchema>;
export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

export async function extractEventDraft(input: ExtractInput, now = new Date()): Promise<MuseJobResult<ExtractOutput>> {
  const image =
    input.imageBase64 && input.imageMediaType
      ? { base64: input.imageBase64, mediaType: input.imageMediaType }
      : undefined;
  return runMuseJob({
    request: {
      system: [
        `You read campus event flyers at ${CAMPUS_NAME} and return one JSON object, nothing else.`,
        "Keys: title, description, start, end (ISO 8601 with offset), placeName, free (boolean),",
        'food (boolean), foodNote (optional), access ({"kind":"open"} or {"kind":"rsvp","capacity":n}),',
        "confidence (map of field name to a number from 0 to 1 for title, description, start, end, place, free, food, access).",
        "Use low confidence when you are guessing.",
      ].join(" "),
      prompt: `Now is ${now.toISOString()} (campus time zone ${CAMPUS_TIME_ZONE}).\nCaption:\n${input.caption}`,
      image,
    },
    outputSchema: ExtractOutputSchema,
    fixture: () => extractFixture(now),
  });
}
