// Client-safe shapes of the Muse route responses. No server imports here.
export type AnswerSource = "muse" | "fixture";

// What Ask Muse can do for the student, and the feed lists it can switch to.
export const ASK_ACTIONS = ["rsvp", "cancel_rsvp", "interested", "open", "filter", "plan_night", "create_event", "invite_friend"] as const;
export type AskActionType = (typeof ASK_ACTIONS)[number];
export const FEED_FILTERS = ["forYou", "free", "today", "week"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export type AskAction = { type: AskActionType; eventId: string | null; filter: FeedFilter | null };
export type Point = { lat: number; lng: number };
export type AskReply = {
  answer: string;
  eventIds: string[];
  actions: AskAction[];
  followUp: string | null;
  learnedTopics: string[];
  // Where a "plan my night" hand-off starts and ends, set by the server.
  // note is what the student said, so the crawl keeps the places and times they named.
  plan: { from: Point; to: Point; note: string } | null;
};

/** The window event the Ask bar sends to switch the Events feed list. */
export const FEED_FILTER_EVENT = "muse:feed-filter";

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
