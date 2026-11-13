import type { Category } from "@/lib/map/category";

// Event markers are round bubbles: the organizer's logo in a white ring, with
// a small line icon badge for what the event is. When there is no logo (or it
// fails to load) the bubble shows the organizer's monogram on a soft tint for
// the kind of event. Icons are SVG strings because map markers are plain
// DOM owned by MapLibre, not React. 24 by 24, drawn with currentColor.

const line = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;width:100%;height:100%">${body}</svg>`;

export const CATEGORY_ICONS: Record<Category, string> = {
  pizza: line(
    '<path d="M3.5 6.5C9 3.5 15 3.5 20.5 6.5L12 21.5Z"/><path d="M4.8 9.2c4.6-2.2 9.8-2.2 14.4 0"/><circle cx="10" cy="11.5" r="1" fill="currentColor"/><circle cx="14" cy="13" r="1" fill="currentColor"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/>',
  ),
  taco: line('<path d="M2.5 17a9.5 9.5 0 0 1 19 0Z"/><path d="M6 13.5c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0"/>'),
  boba: line(
    '<path d="M6 8h12l-1.6 13H7.6Z"/><path d="M5 8h14"/><path d="M13 8l2.5-5.5"/><circle cx="10" cy="17.5" r=".9" fill="currentColor"/><circle cx="13" cy="18" r=".9" fill="currentColor"/><circle cx="11.5" cy="15.5" r=".9" fill="currentColor"/>',
  ),
  coffee: line('<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/>'),
  meal: line('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2.2 1.4-3 4-3 7h3"/>'),
  climb: line('<path d="M2.5 20 9 9l4 6 3-4 5.5 9Z"/><path d="M9 9l1.7 2.6"/>'),
  yoga: line('<circle cx="12" cy="4.8" r="1.8"/><path d="M12 7.5v6M5 11l7 2.5 7-2.5M8 20l4-6.5 4 6.5"/>'),
  film: line('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>'),
  music: line('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  code: line('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>'),
  study: line('<path d="M3 5.5c3-1.3 6-1.3 9 .8 3-2.1 6-2.1 9-.8V19c-3-1.3-6-1.3-9 .8-3-2.1-6-2.1-9-.8Z"/><path d="M12 6.3v13.5"/>'),
  career: line('<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M8.5 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2M3 12.5h18"/>'),
  event: line('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
};

type Tint = { fill: string; ink: string };

// Four muted families so the fallback bubbles read as kinds, not a rainbow.
const FOOD: Tint = { fill: "#faece7", ink: "#993c1d" };
const CULTURE: Tint = { fill: "#eeedfe", ink: "#3c3489" };
const ACTIVE: Tint = { fill: "#e1f5ee", ink: "#085041" };
const LEARN: Tint = { fill: "#e6f1fb", ink: "#0c447c" };
const OTHER: Tint = { fill: "#f1efe8", ink: "#444441" };

export const CATEGORY_TINTS: Record<Category, Tint> = {
  pizza: FOOD,
  taco: FOOD,
  boba: FOOD,
  coffee: FOOD,
  meal: FOOD,
  film: CULTURE,
  music: CULTURE,
  climb: ACTIVE,
  yoga: ACTIVE,
  code: LEARN,
  study: LEARN,
  career: LEARN,
  event: OTHER,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  pizza: "Pizza",
  taco: "Tacos",
  boba: "Boba",
  coffee: "Coffee",
  meal: "Food",
  climb: "Climbing",
  yoga: "Yoga",
  film: "Film",
  music: "Music",
  code: "Build",
  study: "Study",
  career: "Career",
  event: "Event",
};

const SMALL_WORDS = new Set(["a", "an", "the", "and", "of", "to", "for", "at", "in", "on", "with", "by"]);

/** Two letters for a bubble with no flyer: "Intro to bouldering night" gives "IB". */
export function initials(title: string): string {
  const words = title
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !SMALL_WORDS.has(word.toLowerCase()));
  const letters = words.slice(0, 2).map((word) => word[0]!.toUpperCase());
  return letters.join("") || "?";
}

/**
 * A club or business monogram for a bubble with no logo. A short all-caps
 * first word is kept as is ("HSA at MIT" gives "HSA", "MIT Sloan" gives
 * "MIT"); otherwise the first letters of the first two real words.
 */
export function monogram(name: string): string {
  const first = name.trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  if (first.length >= 2 && first.length <= 4 && first === first.toUpperCase() && /\p{L}/u.test(first)) return first;
  return initials(name);
}
