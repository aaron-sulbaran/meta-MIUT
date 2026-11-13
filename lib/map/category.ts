import type { CampusEvent } from "@/lib/events/schema";

// What an event is about, guessed from its words, so the map can show a pizza
// for pizza and a film reel for a screening. First match wins, so specific
// foods come before the generic meal. Replace with a Muse-given category if
// the event contract gains one.

export const CATEGORIES = [
  "pizza",
  "taco",
  "boba",
  "coffee",
  "meal",
  "climb",
  "yoga",
  "film",
  "music",
  "code",
  "study",
  "career",
  "event",
] as const;

export type Category = (typeof CATEGORIES)[number];

const RULES: [Category, RegExp][] = [
  ["pizza", /\bpizza/],
  ["taco", /\btacos?\b|burrito/],
  ["boba", /\bboba\b|bubble tea/],
  ["coffee", /\bcoffee|espresso|\bcafe\b|donut/],
  ["climb", /climb|boulder/],
  ["yoga", /\byoga|meditat|pilates/],
  ["film", /\bfilm|movie|screening|cinema/],
  ["music", /concert|orchestra|\bband\b|music|\bjazz|a cappella|\bdj\b/],
  ["code", /hack|\bcode|coding|build night|robot|hardware/],
  ["study", /\bstudy|library|tutor/],
  ["career", /career|resume|recruit|interview|networking/],
  ["meal", /dinner|lunch|breakfast|food|snack|bbq|cookout|dessert|ice cream/],
];

export function eventCategory(event: Pick<CampusEvent, "title" | "description" | "foodNote">): Category {
  const title = event.title.toLowerCase();
  const rest = `${event.foodNote ?? ""} ${event.description}`.toLowerCase();
  // The title says what the event is; the food note and description fill gaps.
  for (const text of [title, rest]) {
    for (const [category, pattern] of RULES) if (pattern.test(text)) return category;
  }
  return "event";
}
