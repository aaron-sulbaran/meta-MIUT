// What Muse reads to curate User 3's first events feed: seeded stand-ins for
// the accounts a real launch would connect (email, calendar, Instagram, Reels).
// Client safe: the curate screen shows each source as Muse reads it. The data
// is invented for the demo and leans toward the story event on purpose.

export type ConnectorSource = { id: "email" | "calendar" | "instagram" | "reels"; label: string; reading: string; items: string[] };

export const USER3_CONNECTORS: ConnectorSource[] = [
  {
    id: "email",
    label: "Email",
    reading: "Reading your email",
    items: [
      "MIT Board Game Club newsletter: game nights are back this week, dumplings while they last",
      "Order shipped: Catan, Cities and Knights expansion",
      "MIT Film Society: November screening list",
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    reading: "Checking your calendar",
    items: ["Last class today ends at 5:00 PM", "Nothing planned tonight", "Problem set due Monday"],
  },
  {
    id: "instagram",
    label: "Instagram",
    reading: "Looking at your Instagram",
    items: [
      "Follows @mit_boardgames, @mit_film, and two food accounts",
      "Liked 6 board game posts and 4 dumpling posts this month",
      "Saved a post: best late-night food near Kendall",
    ],
  },
  {
    id: "reels",
    label: "Reels",
    reading: "Watching what you watch on Reels",
    items: ["Watches board game strategy reels to the end", "Rewatched two dumpling-folding reels", "Skips gym and running content"],
  },
];

export type CuratedPick = { eventId: string; reason: string };
