// What Muse reads to curate User 3's first events feed: seeded stand-ins for
// the accounts a real launch would connect. Client safe: the onboarding sheet
// lists each source with its mark and shows `found` as Muse reads it, and the
// curate request sends every item to the model. The data is invented for the
// demo and leans toward the story event on purpose; the screen says it is sample data.

export type ConnectorId = "calendar" | "email" | "instagram" | "reels" | "chats" | "groups";

// The official mark a row shows (public/brand/, see components/curate/source-mark.tsx).
export type ConnectorMark = "google-calendar" | "gmail" | "instagram" | "facebook";

export type ConnectorSource = {
  id: ConnectorId;
  label: string;
  mark: ConnectorMark;
  // What Muse would look at there, in the opt-in's list.
  what: string;
  reading: string;
  // One short line of what Muse found in the items below, shown when the row ticks.
  found: string;
  items: string[];
};

export const USER3_CONNECTORS: ConnectorSource[] = [
  {
    id: "calendar",
    what: "When you are free",
    label: "Google Calendar",
    mark: "google-calendar",
    reading: "Checking your calendar",
    found: "Free now, your last class ended at 3:00 PM",
    items: ["Last class today ended at 3:00 PM", "Free the rest of today", "Problem set due Monday"],
  },
  {
    id: "email",
    what: "Club and event emails",
    label: "Gmail",
    mark: "gmail",
    reading: "Reading your email",
    found: "Board Game Club: game nights are back this week",
    items: [
      "MIT Board Game Club newsletter: game nights are back this week, dumplings while they last",
      "Order shipped: Catan, Cities and Knights expansion",
      "MIT Film Society: November screening list",
    ],
  },
  {
    id: "instagram",
    what: "Accounts you follow",
    label: "Instagram",
    mark: "instagram",
    reading: "Looking at who you follow on Instagram",
    found: "@mit_boardgames, @mit_film and two food accounts",
    items: [
      "Follows @mit_boardgames, @mit_film, and two food accounts",
      "Liked 6 board game posts and 4 dumpling posts this month",
      "Saved a post: best late-night food near Kendall",
    ],
  },
  {
    id: "reels",
    what: "What you watch",
    label: "Instagram Reels",
    mark: "instagram",
    reading: "Watching what you watch on Reels",
    found: "Board game strategy reels, watched to the end",
    items: ["Watches board game strategy reels to the end", "Rewatched two dumpling-folding reels", "Skips gym and running content"],
  },
  {
    id: "chats",
    what: "Plans with friends",
    label: "Instagram group chats",
    mark: "instagram",
    reading: "Reading your Instagram group chats",
    found: "\"catan crew\" asked who is free for games this week",
    items: [
      "Instagram group chat \"catan crew\" (4 friends): someone asked who is free for a game night this week",
      "Instagram group chat \"kendall eats\": trading late-night dumpling spots",
    ],
  },
  {
    id: "groups",
    what: "Groups you are in",
    label: "Facebook Groups",
    mark: "facebook",
    reading: "Checking the groups you are in on Facebook",
    found: "In MIT Free Food and MIT Tabletop Games",
    items: [
      "Member of MIT Free Food, reads it but never posts",
      "Member of MIT Tabletop Games",
      "Member of MIT Class of 2028",
    ],
  },
];

export type CuratedPick = { eventId: string; reason: string };
