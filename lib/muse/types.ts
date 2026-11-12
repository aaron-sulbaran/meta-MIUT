// Client-safe shapes of the Muse route responses. No server imports here.
export type AnswerSource = "muse" | "fixture";

export type MuseRouteResponse<T> = {
  data: T | null;
  error: string | null;
  source?: AnswerSource;
  fallbackReason?: string | null;
};
