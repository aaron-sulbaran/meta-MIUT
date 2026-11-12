// Client-safe shapes of the Muse route responses. No server imports here.
export type AnswerSource = "muse" | "fixture";

export type MuseRouteResponse<T> = {
  data: T | null;
  error: string | null;
  source?: AnswerSource;
  fallbackReason?: string | null;
};

// An event the student is likely to care about, from compileCandidates.
export type LikelyEvent = {
  eventId: string;
  score: number;
  today: boolean;
  walkMinutes: number;
  // The class it overlaps, or null.
  clash: string | null;
  // Topics and followed clubs that matched, for example "rock climbing" or "@sample_climbing".
  matched: string[];
  reason: string;
};
