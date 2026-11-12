import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { ExtractOutputSchema, type EvidenceField, type ExtractOutput } from "@/lib/muse/extract";
import { matchFixture } from "@/lib/muse/fixtures/match";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// A new draft against events already listed: is it a repost of one of them, and what does it add?
// Code picks the candidates and applies the values; Muse only judges sameness and which fields changed.

const DAY = 86_400_000;
export const SAME_ORGANIZER_WINDOW_MS = 7 * DAY;
export const OTHER_ORGANIZER_WINDOW_MS = 2 * 3_600_000;

export const MATCH_FIELDS = ["title", "start", "end", "placeName", "free", "food", "foodNote", "access"] as const;
export type MatchField = (typeof MATCH_FIELDS)[number];

const EVIDENCE_FOR: Record<MatchField, EvidenceField> = {
  title: "title",
  start: "start",
  end: "end",
  placeName: "place",
  free: "free",
  food: "food",
  foodNote: "food",
  access: "access",
};

export const MatchInputSchema = z.object({
  draft: ExtractOutputSchema,
  organizerHandle: z.string().min(1),
});
export type MatchInput = z.infer<typeof MatchInputSchema>;

export const MatchOutputSchema = z.object({
  sameAs: z.string().nullable(),
  reason: z.string(),
  changed: z.array(z.enum(MATCH_FIELDS)),
});
export type MatchOutput = z.infer<typeof MatchOutputSchema>;

export const MATCH_STRUCTURED_OUTPUT = museStructuredOutput("event_match", MatchOutputSchema);

export type EventUpdates = Partial<Pick<ExtractOutput, MatchField>>;
export type EventMatch = { eventId: string | null; reason: string; updates: EventUpdates };

const handleKey = (handle: string) => handle.trim().toLowerCase().replace(/^@/, "");

export function matchCandidates(draft: ExtractOutput, organizerHandle: string, events: CampusEvent[]): CampusEvent[] {
  const start = Date.parse(draft.start);
  const handle = handleKey(organizerHandle);
  return events.filter((event) => {
    const gap = Math.abs(Date.parse(event.start) - start);
    return handleKey(event.organizer.handle) === handle ? gap <= SAME_ORGANIZER_WINDOW_MS : gap <= OTHER_ORGANIZER_WINDOW_MS;
  });
}

const currentValue = (event: CampusEvent, field: MatchField) => (field === "placeName" ? event.place.name : event[field]);

// Only fields the new post actually states (quoted, not inferred) and that differ may overwrite the listing.
export function updatesFrom(draft: ExtractOutput, event: CampusEvent, changed: MatchField[]): EventUpdates {
  const updates: Record<string, unknown> = {};
  for (const field of new Set(changed)) {
    const evidence = draft.evidence[EVIDENCE_FOR[field]];
    if (evidence === undefined || evidence.from === "inferred") continue;
    const value = draft[field];
    if (value === undefined || JSON.stringify(value) === JSON.stringify(currentValue(event, field))) continue;
    updates[field] = value;
  }
  return updates as EventUpdates;
}

const NO_CANDIDATES = "No listed event from this organizer near this time";

export async function matchExistingEvent(input: MatchInput, events: CampusEvent[]): Promise<MuseJobResult<EventMatch>> {
  const candidates = matchCandidates(input.draft, input.organizerHandle, events);
  if (candidates.length === 0) {
    return { data: { eventId: null, reason: NO_CANDIDATES, updates: {} }, error: null, source: "muse", fallbackReason: null };
  }
  const byId = new Map(candidates.map((event) => [event.id, event]));
  const listed = candidates.map((event) => ({
    id: event.id,
    organizer: event.organizer.handle,
    title: event.title,
    start: event.start,
    end: event.end,
    placeName: event.place.name,
    free: event.free,
    food: event.food,
    foodNote: event.foodNote,
    access: event.access,
  }));
  const draft = Object.fromEntries(MATCH_FIELDS.map((field) => [field, input.draft[field]]));
  const result = await runMuseJob({
    request: {
      system: [
        "Decide whether a new campus Instagram post describes the same real event as one already listed:",
        "a repost, reminder, prize or schedule update, or correction of it. A similar event on another date is not the same.",
        'Return JSON only: {"sameAs": listed id or null, "reason": one short sentence,',
        `"changed": fields the new post gives new or different information for, from ${MATCH_FIELDS.join(", ")}}.`,
      ].join(" "),
      prompt: `New post by ${input.organizerHandle}: ${JSON.stringify(draft)}\nListed events: ${JSON.stringify(listed)}`,
      structuredOutput: MATCH_STRUCTURED_OUTPUT,
    },
    outputSchema: MatchOutputSchema,
    fixture: matchFixture,
    accept: (output) => (output.sameAs === null || byId.has(output.sameAs) ? null : "Muse matched an unknown event id"),
  });
  if (result.error !== null) return result;
  const event = result.data.sameAs === null ? undefined : byId.get(result.data.sameAs);
  return {
    ...result,
    data: {
      eventId: event?.id ?? null,
      reason: result.data.reason,
      updates: event ? updatesFrom(input.draft, event, result.data.changed) : {},
    },
  };
}
