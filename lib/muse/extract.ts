import "server-only";
import { z } from "zod";
import { CAMPUS_NAME, CAMPUS_TIME_ZONE } from "@/lib/brand";
import { AccessSchema, ConfidenceSchema } from "@/lib/events/schema";
import { isStoryCaption, storyExtractFixture } from "@/lib/demo/story-fixtures";
import { extractFixture } from "@/lib/muse/fixtures/extract";
import type { MuseRequest } from "@/lib/muse/client";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Flyer image plus caption, or a spoken line from the organizer, to event drafts with per-field
// evidence and confidence.
// Coordinates are not asked of the model; the organizer flow resolves the place.

export const ExtractInputSchema = z.object({
  caption: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
  imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  // The caption is a transcript of the organizer talking right now, not a post.
  spoken: z.boolean().optional(),
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

// Team rule: a post that names no cost is free, so that default is not flagged as a guess.
export const FREE_BY_DEFAULT_CONFIDENCE = 0.9;

// A spoken line with no time means it is happening now. The end is a guess, so it stays flagged.
export const SPOKEN_NOW_CONFIDENCE = 0.9;
export const SPOKEN_DEFAULT_LENGTH_MS = 3_600_000;

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

export const ExtractListOutputSchema = z.object({ events: z.array(ExtractOutputSchema) });
export type ExtractListOutput = z.infer<typeof ExtractListOutputSchema>;

export const EXTRACT_STRUCTURED_OUTPUT = museStructuredOutput("event_drafts", ExtractListOutputSchema);

// Exported so the spike script sends exactly what the app sends.
export function buildExtractRequest(input: ExtractInput, now: Date): MuseRequest {
  const image =
    input.imageBase64 && input.imageMediaType
      ? { base64: input.imageBase64, mediaType: input.imageMediaType }
      : undefined;
  return {
    system: [
      `You read campus Instagram posts (flyer image plus caption) at ${CAMPUS_NAME} and return one JSON object, nothing else.`,
      'Shape: {"events": [...]}, one entry per separate event people attend at a set time and place.',
      "A flyer listing several events, dates, or sessions gives several entries.",
      "Return an empty list when the post is not such an event, for example a product, merch or care package sale,",
      "a delivery, an online giveaway or raffle, an application or deadline reminder, a recap, or a general announcement.",
      "Free food, swag or merch handed out at a set time and place (a T-shirt table in a lobby from 11 to 2) is an event.",
      "Each entry has keys: title, description, start, end (ISO 8601 with offset), placeName, free (boolean),",
      'food (boolean), foodNote (optional), access ({"kind":"open"} or {"kind":"rsvp","capacity":n}),',
      "confidence (map of field name to a number from 0 to 1 for title, description, start, end, place, free, food, access),",
      'evidence (map of field name to {"quote": exact words copied from the flyer or caption, "from": "caption", "image", or "inferred"}',
      "for title, start, end, place, free, food, access).",
      "free means free to get in. It is true unless the post names a price, entry fee, ticket, cover, or paid registration;",
      "free food or drinks are evidence for food, not for free, and things sold at the event do not make it not free.",
      'When no cost is mentioned, set free true with evidence "inferred"; when a cost is mentioned, quote it.',
      'Copy quotes word for word, never paraphrase. Use "inferred" with an empty quote when no text says it. Use low confidence when you are guessing.',
      ...(input.spoken
        ? [
            "This time the text is not a post: it is an organizer speaking, transcribed, about something happening now,",
            'for example leftover food. Their words count as "caption". Give a short plain title.',
            'When they name no start time it starts now; when they name no end it ends an hour after the start; mark those "inferred".',
          ]
        : []),
    ].join(" "),
    prompt: `Now is ${now.toISOString()} (campus time zone ${CAMPUS_TIME_ZONE}).\n${input.spoken ? "Organizer said" : "Caption"}:\n${input.caption}`,
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
    if (field === "free" && draft.free && given?.from !== "caption" && given?.from !== "image") {
      evidence.free = { quote: "", from: "inferred" };
      confidence.free = FREE_BY_DEFAULT_CONFIDENCE;
      continue;
    }
    if (!grounded && score !== undefined) confidence[field] = Math.min(score, UNGROUNDED_CONFIDENCE_CAP);
  }
  return { ...draft, evidence, confidence };
}

// Run after groundDraft, so "inferred" here also covers times Muse claimed but the speaker never said.
export function applySpokenDefaults(draft: ExtractOutput, now: Date): ExtractOutput {
  const said = (field: "start" | "end") => draft.evidence[field]?.from === "caption";
  const start = said("start") ? draft.start : now.toISOString();
  // "until 5" said at 5:30 reads as already over; keep the event and flag the end instead.
  const endSaid = said("end") && Date.parse(draft.end) > Date.parse(start);
  const end = endSaid ? draft.end : new Date(Date.parse(start) + SPOKEN_DEFAULT_LENGTH_MS).toISOString();
  const confidence = { ...draft.confidence };
  if (!said("start")) confidence.start = SPOKEN_NOW_CONFIDENCE;
  if (!endSaid) confidence.end = Math.min(confidence.end ?? UNGROUNDED_CONFIDENCE_CAP, UNGROUNDED_CONFIDENCE_CAP);
  return { ...draft, start, end, confidence };
}

// Must match the reason runMuseJob gives; the extract retry test fails if it drifts.
const SCHEMA_MISMATCH = "Muse output did not match the schema";

export const NOT_AN_EVENT = "Muse found no event in this post";

// Every event in the post; an empty list means Muse judged it is not an event.
export async function extractEventDrafts(
  input: ExtractInput,
  now = new Date(),
): Promise<MuseJobResult<ExtractListOutput>> {
  const job = () =>
    runMuseJob({
      request: buildExtractRequest(input, now),
      outputSchema: ExtractListOutputSchema,
      // The demo story's own flyer falls back to its own recorded draft, never the sample post.
      fixture: () => ({ events: [isStoryCaption(input.caption) ? storyExtractFixture(input.caption) : extractFixture(now)] }),
    });
  // Ember sometimes returns a draft that misses the schema; one retry is about 3 s and beats showing the fixture.
  let result = await job();
  if (result.source === "fixture" && result.fallbackReason === SCHEMA_MISMATCH) result = await job();
  if (result.data === null || result.source !== "muse") return result;
  const finish = (draft: ExtractOutput) => {
    const grounded = groundDraft(draft, input.caption);
    return input.spoken ? applySpokenDefaults(grounded, now) : grounded;
  };
  return { ...result, data: { events: result.data.events.map(finish) } };
}

// First event only, for screens that show one draft.
export async function extractEventDraft(input: ExtractInput, now = new Date()): Promise<MuseJobResult<ExtractOutput>> {
  const result = await extractEventDrafts(input, now);
  if (result.data === null) return { data: null, error: result.error, source: result.source, fallbackReason: result.fallbackReason };
  const first = result.data.events[0];
  if (first === undefined) return { ...result, data: null, error: NOT_AN_EVENT };
  return { ...result, data: first };
}
