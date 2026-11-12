import "server-only";
import { z } from "zod";
import { CAMPUS_NAME, CAMPUS_TIME_ZONE } from "@/lib/brand";
import { AccessSchema, ConfidenceSchema } from "@/lib/events/schema";
import { extractFixture } from "@/lib/muse/fixtures/extract";
import type { MuseRequest } from "@/lib/muse/client";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Flyer image plus caption to an event draft with per-field evidence and confidence.
// Coordinates are not asked of the model; the organizer flow resolves the place.

export const ExtractInputSchema = z.object({
  caption: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
  imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
});

export const EVIDENCE_FIELDS = ["title", "start", "end", "place", "free", "food", "access"] as const;
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

// `from` says where the quote was read. "inferred" means no text says it outright.
export const EvidenceSchema = z.object({
  quote: z.string(),
  from: z.enum(["caption", "image", "inferred"]),
});

// Confidence is capped here when a field has no evidence or its caption quote is not in the caption.
export const UNGROUNDED_CONFIDENCE_CAP = 0.5;

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
  evidence: z.partialRecord(z.enum(EVIDENCE_FIELDS), EvidenceSchema),
});

export type ExtractInput = z.infer<typeof ExtractInputSchema>;
export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

export const EXTRACT_STRUCTURED_OUTPUT = museStructuredOutput("event_draft", ExtractOutputSchema);

// Exported so the spike script sends exactly what the app sends.
export function buildExtractRequest(input: ExtractInput, now: Date): MuseRequest {
  const image =
    input.imageBase64 && input.imageMediaType
      ? { base64: input.imageBase64, mediaType: input.imageMediaType }
      : undefined;
  return {
    system: [
      `You read campus event flyers at ${CAMPUS_NAME} and return one JSON object, nothing else.`,
      "Keys: title, description, start, end (ISO 8601 with offset), placeName, free (boolean),",
      'food (boolean), foodNote (optional), access ({"kind":"open"} or {"kind":"rsvp","capacity":n}),',
      "confidence (map of field name to a number from 0 to 1 for title, description, start, end, place, free, food, access),",
      'evidence (map of field name to {"quote": exact words copied from the flyer or caption, "from": "caption", "image", or "inferred"}',
      "for title, start, end, place, free, food, access).",
      'Copy quotes word for word, never paraphrase. Use "inferred" with an empty quote when no text says it. Use low confidence when you are guessing.',
    ].join(" "),
    prompt: `Now is ${now.toISOString()} (campus time zone ${CAMPUS_TIME_ZONE}).\nCaption:\n${input.caption}`,
    image,
    structuredOutput: EXTRACT_STRUCTURED_OUTPUT,
  };
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// The model can claim a caption quote it made up. Check caption quotes against the caption,
// downgrade the ones that are not there to "inferred", and cap confidence of ungrounded fields.
// Image quotes cannot be checked here and are kept as given.
export function groundDraft(draft: ExtractOutput, caption: string): ExtractOutput {
  const haystack = normalize(caption);
  const evidence: ExtractOutput["evidence"] = {};
  const confidence: ExtractOutput["confidence"] = { ...draft.confidence };
  for (const field of EVIDENCE_FIELDS) {
    const given = draft.evidence[field];
    const quote = given ? normalize(given.quote) : "";
    const grounded =
      given !== undefined && quote.length > 0 && (given.from === "image" || haystack.includes(quote));
    evidence[field] = grounded ? given : { quote: given?.quote ?? "", from: "inferred" };
    const score = confidence[field];
    if (!grounded && score !== undefined) confidence[field] = Math.min(score, UNGROUNDED_CONFIDENCE_CAP);
  }
  return { ...draft, evidence, confidence };
}

export async function extractEventDraft(input: ExtractInput, now = new Date()): Promise<MuseJobResult<ExtractOutput>> {
  const result = await runMuseJob({
    request: buildExtractRequest(input, now),
    outputSchema: ExtractOutputSchema,
    fixture: () => extractFixture(now),
  });
  if (result.data === null || result.source !== "muse") return result;
  return { ...result, data: groundDraft(result.data, input.caption) };
}
