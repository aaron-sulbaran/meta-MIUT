import type { MuseRouteResponse } from "@/lib/muse/types";

// Client-safe mirrors of the extract and match route bodies (lib/muse/extract.ts and
// lib/muse/match.ts are server only). Keep in step with those schemas.

export const DRAFT_EVIDENCE_FIELDS = ["title", "start", "end", "place", "free", "food", "access"] as const;
export type DraftEvidenceField = (typeof DRAFT_EVIDENCE_FIELDS)[number];

export type DraftEvidence = { quote: string; from: "caption" | "image" | "inferred" };

export type DraftAccess = { kind: "open" | "rsvp"; capacity?: number };

export type ExtractDraft = {
  title: string;
  description: string;
  start: string;
  end: string;
  placeName: string;
  free: boolean;
  food: boolean;
  foodNote?: string;
  access: DraftAccess;
  confidence: Partial<Record<string, number>>;
  evidence: Partial<Record<DraftEvidenceField, DraftEvidence>>;
};

export type ExtractDraftsResponse = MuseRouteResponse<{ events: ExtractDraft[] }>;

export type DraftUpdates = Partial<
  Pick<ExtractDraft, "title" | "start" | "end" | "placeName" | "free" | "food" | "foodNote" | "access">
>;

export type MatchResponse = MuseRouteResponse<{ eventId: string | null; reason: string; updates: DraftUpdates }>;

export type OrganizerOption = { name: string; handle: string };

export type InputMode = "photo" | "voice";

export type FlyerImage = { base64: string; mediaType: "image/jpeg"; previewUrl: string };
