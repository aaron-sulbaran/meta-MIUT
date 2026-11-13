import type { DraftEvidence, ExtractDraft } from "@/components/organizer/types";

// Where each line sits on the demo's drawn flyer (app/demo/flyer.png, 1080 by
// 1350). Keep in step with that route's layout. Muse returns quotes, not
// coordinates: a box goes on the flyer only where Muse's quoted words are
// actually printed, matched here word by word. A quote that is not on the
// flyer is shown on the caption instead, and a field Muse inferred is flagged.

export const FLYER_SIZE = { width: 1080, height: 1350 } as const;

export type FlyerRegion = { id: MomentField; text: string; x: number; y: number; width: number; height: number };

export const MOMENT_FIELDS = ["title", "when", "where", "food", "access"] as const;
export type MomentField = (typeof MOMENT_FIELDS)[number];

export function flyerRegions(timeLine: string): FlyerRegion[] {
  return [
    { id: "title", text: "Board game night", x: 70, y: 176, width: 850, height: 256 },
    { id: "food", text: "+ Free dumplings", x: 70, y: 456, width: 745, height: 92 },
    { id: "when", text: `Today · ${timeLine}`, x: 68, y: 930, width: 784, height: 130 },
    { id: "where", text: "MIT Museum, 314 Main St", x: 68, y: 1080, width: 640, height: 74 },
    { id: "access", text: "Open to everyone · 40 games · no experience needed", x: 68, y: 1160, width: 810, height: 96 },
  ];
}

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Share of the shorter text's words found in the other, 0 to 1. */
export function wordOverlap(quote: string, printed: string): number {
  const quoted = words(quote);
  const onFlyer = new Set(words(printed));
  if (quoted.length === 0 || onFlyer.size === 0) return 0;
  const shared = quoted.filter((word) => onFlyer.has(word)).length;
  return shared / Math.min(quoted.length, onFlyer.size);
}

const MATCH = 0.6;
// Below this Muse's own confidence, the field is shown as a guess.
const SURE = 0.7;

export type FieldSource =
  | { kind: "flyer"; region: FlyerRegion; quote: string }
  | { kind: "caption"; quote: string }
  | { kind: "guess" };

export type ReadField = { id: MomentField; label: string; value: string; source: FieldSource; guessed: boolean };

const EVIDENCE_KEY: Record<MomentField, "title" | "start" | "place" | "food" | "access"> = {
  title: "title",
  when: "start",
  where: "place",
  food: "food",
  access: "access",
};

const CONFIDENCE_KEY: Record<MomentField, string> = { title: "title", when: "start", where: "place", food: "food", access: "access" };

/** Where a quote is printed on the flyer: its own field's line first, then any line. */
export function locateQuote(field: MomentField, quote: string, regions: FlyerRegion[]): FlyerRegion | null {
  if (!quote.trim()) return null;
  const own = regions.find((region) => region.id === field);
  if (own && wordOverlap(quote, own.text) >= MATCH) return own;
  let best: { region: FlyerRegion; score: number } | null = null;
  for (const region of regions) {
    const score = wordOverlap(quote, region.text);
    if (score >= MATCH && (!best || score > best.score)) best = { region, score };
  }
  return best?.region ?? null;
}

function sourceOf(field: MomentField, evidence: DraftEvidence | undefined, regions: FlyerRegion[]): FieldSource {
  if (!evidence || evidence.from === "inferred" || !evidence.quote.trim()) return { kind: "guess" };
  const region = locateQuote(field, evidence.quote, regions);
  return region ? { kind: "flyer", region, quote: evidence.quote } : { kind: "caption", quote: evidence.quote };
}

/** The five fields the moment shows, each with where Muse read it. */
export function readFields(draft: ExtractDraft, regions: FlyerRegion[], formatWhen: (draft: ExtractDraft) => string): ReadField[] {
  const values: Record<MomentField, { label: string; value: string }> = {
    title: { label: "What it is", value: draft.title },
    when: { label: "When", value: formatWhen(draft) },
    where: { label: "Where", value: draft.placeName },
    food: { label: "Free food", value: draft.food ? draft.foodNote?.trim() || "Yes" : "None mentioned" },
    access: { label: "Who can come", value: draft.access.kind === "rsvp" ? "RSVP required" : "Open to everyone" },
  };
  return MOMENT_FIELDS.map((id) => {
    const source = sourceOf(id, draft.evidence[EVIDENCE_KEY[id]], regions);
    const confidence = draft.confidence[CONFIDENCE_KEY[id]];
    const guessed = source.kind === "guess" || (typeof confidence === "number" && confidence < SURE);
    return { id, ...values[id], source, guessed };
  });
}
