import type { PersonaId } from "@/lib/social/persona";

// The pitch as an ordered list of beats, from kb/demo-script in the hub. Client
// safe: the /demo stage reads it. Each beat is one tap and one spoken line.
// Every beat sets its own persona and screen from scratch, so any beat can be
// skipped or jumped to without the one before it.

export type BeatAct = "pitch" | "organizer" | "user1" | "lisa" | "user3";

// Screens that imitate another app; they live only under /demo (t-y329).
export type StagedScreen = "instagram-new-post" | "instagram-crosspost-prompt" | "invite-message" | "instagram-feed-prompt";

export type BeatContext = { storyEventId: string; now: Date };

export type Beat = {
  id: string;
  act: BeatAct;
  // Null plays Aaron, the sample student (no cookie).
  persona: PersonaId | null;
  kind: "slide" | "staged" | "app";
  title: string;
  // What the audience should take from this beat, shown large beside the phone.
  caption: string;
  // App beats: the screen to load in the phone. Staged beats: where tapping hands off to.
  path?: (context: BeatContext) => string;
  staged?: StagedScreen;
  // Run once when the beat opens (for example, fire the class-ended alert).
  setup?: "class-ended-alert";
};

export const ACT_LABELS: Record<BeatAct, string> = {
  pitch: "The pitch",
  organizer: "Organizer",
  user1: "User 1: uses Facebook Events",
  lisa: "Lisa: no Facebook account",
  user3: "User 3: has Facebook, new to Events",
};

export const PERSONA_LABELS: Record<PersonaId | "aaron", string> = {
  aaron: "Aaron",
  lisa: "Lisa",
  user3: "Jordan",
  organizer: "MIT Board Game Club",
};

const eventPath = ({ storyEventId }: BeatContext) => `/events/${encodeURIComponent(storyEventId)}`;

export const BEATS: Beat[] = [
  {
    id: "P1",
    act: "pitch",
    persona: null,
    kind: "slide",
    title: "The problem",
    caption: "Young adults go to Facebook to get something done, like Marketplace, not to scroll.",
  },
  {
    id: "P2",
    act: "pitch",
    persona: null,
    kind: "slide",
    title: "How Muse powers it",
    caption: "Muse reads the posts, knows your day, and brings you to the thing worth leaving for.",
  },
  {
    id: "O1",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-new-post",
    title: "The club posts its flyer on Instagram",
    caption: "An organizer posts the event the way they always do: on Instagram.",
    path: () => "/organizer?from=instagram",
  },
  {
    id: "O2",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-crosspost-prompt",
    title: "This looks like an event. Post it to Facebook Events?",
    caption: "Instagram notices it is an event and offers to put it on Facebook Events.",
    path: () => "/organizer?from=instagram",
  },
  {
    id: "O3",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "Muse is making your Facebook event",
    caption: "Muse reads the flyer and fills in the date, place, free food, and who can come.",
    path: () => "/organizer?from=instagram",
  },
  {
    id: "O5",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "One tap to post",
    caption: "The organizer checks it and posts. The event exists.",
    path: () => "/organizer?from=instagram",
  },
  {
    id: "U1a",
    act: "user1",
    persona: null,
    kind: "app",
    setup: "class-ended-alert",
    title: "Class just ended",
    caption: "Aaron gets out of class. Muse: want to grab a free bite?",
    path: () => "/",
  },
  {
    id: "U1b",
    act: "user1",
    persona: null,
    kind: "app",
    title: "The best stop on the way home",
    caption: "Muse maps the best free food on his usual way home.",
    path: ({ now }) => `/?plan=home&time=${encodeURIComponent(now.toISOString())}`,
  },
  {
    id: "U1c",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Actually, I'm meeting Lisa",
    caption: "He tells Muse out loud: find one closer to both of us and invite her.",
    path: ({ now }) => `/?plan=home&time=${encodeURIComponent(now.toISOString())}`,
  },
  {
    id: "U2a",
    act: "lisa",
    persona: "lisa",
    kind: "staged",
    staged: "invite-message",
    title: "Lisa gets the invite",
    caption: "Aaron's Muse sends Lisa the event.",
    path: (context) => `${eventPath(context)}?invite=sample-student`,
  },
  {
    id: "U2b",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "No Facebook account? One tap.",
    caption: "Lisa has Instagram, so her Meta account makes Facebook one tap.",
    path: (context) => `${eventPath(context)}?invite=sample-student`,
  },
  {
    id: "U2c",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "Aaron knows you're going",
    caption: "She lands on the event, and Aaron knows she is coming.",
    path: eventPath,
  },
  {
    id: "U3a",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-feed-prompt",
    title: "Scrolling Instagram",
    caption: "Jordan sees a club's event on Instagram: check it out on Facebook Events?",
    path: () => "/curate",
  },
  {
    id: "U3b",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "Curate your event feed",
    caption: "Muse reads what Jordan already likes and builds an events feed in seconds.",
    path: () => "/curate",
  },
  {
    id: "U3d",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "Who's going?",
    caption: "Number one is the same event, and Aaron and Lisa are going. Jordan goes too.",
    path: eventPath,
  },
  {
    id: "P4",
    act: "pitch",
    persona: null,
    kind: "slide",
    title: "How we built it",
    caption: "Five people, five agents, one shared board. Where AI helped, and where it did not.",
  },
];
