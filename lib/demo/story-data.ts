// The demo's one event as plain data, client safe: the staged screens (the
// flyer, the Instagram post) and lib/demo/story.ts (which lists it) read it from
// here so they always match. Its place sits between Aaron (Stata) and Lisa
// (Kendall Square), which is what "find one closer to both of us" lands on.

export const STORY_ORGANIZER = { name: "MIT Board Game Club", handle: "mit_boardgames" } as const;
export const STORY_FALLBACK_ID = "evt-demo-story";

export const STORY = {
  title: "Board Game Night",
  description: "Drop in after class: free dumplings while they last, 40 board games, no experience needed. Open to everyone.",
  placeName: "MIT Museum, 314 Main St",
  startsInMinutes: 25,
  durationMinutes: 120,
  foodNote: "Dumplings",
} as const;
