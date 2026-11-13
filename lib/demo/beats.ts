import { HANDOFF, LIVE_ACTIVITY_PATH } from "@/lib/demo/staged";
import type { PersonaId } from "@/lib/social/persona";

// The pitch as an ordered list of beats, from kb/demo-script in the hub. Client
// safe: the /demo stage reads it. Each beat is one tap and one spoken line.
// Every beat sets its own persona and screen from scratch, so any beat can be
// skipped or jumped to without the one before it.

export type BeatAct = "pitch" | "organizer" | "user1" | "lisa" | "user3";

// Screens that imitate another app; they live only under /demo (Builder 2's
// t-y329). Staged beats load their route in the phone; until a route exists the
// stage shows a placeholder for it.
export type StagedScreen =
  | "instagram-new-post"
  | "instagram-crosspost-prompt"
  | "live-activity"
  | "invite-message"
  | "instagram-feed-prompt";

// now is the run's clock: stamped when the first live beat opens, so every
// screen (the flyer, the organizer's draft, the walk home) shows the same
// times. storyEventId is null until the organizer act is over (or skipped): the stage
// creates the story event only then, so Muse sees no earlier copy at O3 and
// the organizer publishes a new event instead of updating one.
export type BeatContext = { storyEventId: string | null; now: Date };

export type Beat = {
  id: string;
  act: BeatAct;
  // Null plays Aaron, the sample student (no cookie).
  persona: PersonaId | null;
  // A video beat plays `video` full bleed; a slide does too when its file exists.
  kind: "slide" | "staged" | "app" | "video";
  title: string;
  // What the audience should take from this beat, shown large beside the phone.
  caption: string;
  // The screen to load in the phone: a real app path, or a staged screen's route.
  // Null while the beat waits for the story event.
  path?: (context: BeatContext) => string | null;
  staged?: StagedScreen;
  // The drawn visual a slide carries.
  slide?: SlideVisual;
  // A file under public/demo/ that replaces the beat when it exists (a teammate's animation).
  video?: string;
};

export type SlideVisual = "problem" | "muse" | "build";

// The cast, in one place: rename User 3 here once they are cast.
export type CastId = "organizer" | "aaron" | "lisa" | "user3";

export const CAST: Record<CastId, { name: string; role: string }> = {
  organizer: { name: "Jolyn", role: "Event organizer" },
  aaron: { name: "Aaron", role: "Uses Facebook Events" },
  lisa: { name: "Lisa", role: "New to Facebook" },
  user3: { name: "User 3", role: "Has Facebook, new to Events" },
};

/** The cast member a persona plays (no persona is Aaron, the sample student). */
export function castOf(persona: PersonaId | null): CastId {
  return persona ?? "aaron";
}

/** "Lisa · New to Facebook". */
export function castLine(id: CastId): string {
  return `${CAST[id].name} · ${CAST[id].role}`;
}

// Which cast member each act follows, in the order the show meets them.
export const ACT_CAST: Record<Exclude<BeatAct, "pitch">, CastId> = {
  organizer: "organizer",
  user1: "aaron",
  lisa: "lisa",
  user3: "user3",
};

export const ACT_LABELS: Record<BeatAct, string> = {
  pitch: "The pitch",
  organizer: castLine("organizer"),
  user1: castLine("aaron"),
  lisa: castLine("lisa"),
  user3: castLine("user3"),
};

// Who is on screen, named plainly so the room always knows (Aaron's call).
export const PERSONA_CAPTIONS: Record<PersonaId | "aaron", string> = {
  aaron: castLine("aaron"),
  lisa: castLine("lisa"),
  user3: castLine("user3"),
  organizer: castLine("organizer"),
};

const eventPath = ({ storyEventId }: BeatContext) => (storyEventId ? `/events/${encodeURIComponent(storyEventId)}` : null);
const lisaLandingPath = ({ storyEventId }: BeatContext) => (storyEventId ? HANDOFF.lisaLanding(storyEventId, "sample-student") : null);

export const BEATS: Beat[] = [
  {
    id: "P1",
    act: "pitch",
    persona: null,
    kind: "slide",
    slide: "problem",
    video: "/demo/problem.mp4",
    title: "The problem",
    caption: "Young adults open Facebook to get something done, like Marketplace. Events never gets a look.",
  },
  {
    id: "P2",
    act: "pitch",
    persona: null,
    kind: "slide",
    slide: "muse",
    video: "/demo/muse.mp4",
    title: "Muse does three jobs",
    caption: "It reads a post, knows your day, and brings you to the thing worth leaving for.",
  },
  {
    id: "O1",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-new-post",
    title: `${CAST.organizer.name} posts a flyer on Instagram`,
    caption: "The club posts its event the way it always does.",
    path: ({ now }) => HANDOFF.instagramPost(now.toISOString()),
  },
  {
    id: "O2",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-crosspost-prompt",
    title: "Instagram spots an event",
    caption: "One prompt: post it to Facebook Events too?",
    path: ({ now }) => HANDOFF.instagramPost(now.toISOString()),
  },
  {
    id: "O3",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "Muse reads the flyer",
    caption: "Date, place, free food, and who can come, filled in from the image in seconds.",
    path: ({ now }) => HANDOFF.organizerAt(now.toISOString()),
  },
  {
    id: "O5",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "One tap, and it is live",
    caption: `${CAST.organizer.name} checks the draft and posts. Students nearby get an alert.`,
    path: ({ now }) => HANDOFF.organizerAt(now.toISOString()),
  },
  {
    id: "U1a",
    act: "user1",
    persona: null,
    kind: "staged",
    staged: "live-activity",
    title: "Class just ended",
    caption: `3:05 PM. Muse knows ${CAST.aaron.name}'s day: want a free bite on the way home?`,
    path: ({ now }) => `${LIVE_ACTIVITY_PATH}?time=${encodeURIComponent(now.toISOString())}`,
  },
  {
    id: "U1b",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Muse plans the walk home",
    caption: "The best free food on his usual route, already on the map.",
    path: ({ now }) => HANDOFF.walkHome(now.toISOString()),
  },
  {
    id: "U1c",
    act: "user1",
    persona: null,
    kind: "app",
    title: `"Actually, I'm meeting ${CAST.lisa.name}"`,
    caption: "He says it out loud. Muse finds a spot between them and invites her.",
    path: ({ now }) => HANDOFF.walkHome(now.toISOString()),
  },
  {
    id: "U2a",
    act: "lisa",
    persona: "lisa",
    kind: "staged",
    staged: "invite-message",
    title: `${CAST.lisa.name} gets the invite`,
    caption: `${CAST.aaron.name}'s Muse sends it to her on Instagram.`,
    path: () => "/demo/instagram/dm",
  },
  {
    id: "U2b",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "No Facebook account? One tap.",
    caption: "The account she already has on Instagram opens Facebook. No sign-up form.",
    path: lisaLandingPath,
  },
  {
    id: "U2c",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: `${CAST.aaron.name} knows she is coming`,
    caption: "She lands on the event, marked Going, and he gets told.",
    // The same landing as U2b, so it stays on her "you're going" screen.
    path: lisaLandingPath,
  },
  {
    id: "U3a",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-feed-prompt",
    title: `${CAST.user3.name} is scrolling Instagram`,
    caption: "A club they follow posted an event. Check it out on Facebook Events?",
    path: () => "/demo/instagram/feed",
  },
  {
    id: "U3b",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "Muse curates a first feed",
    caption: "From what they already like, Muse builds an Events feed in seconds.",
    path: () => HANDOFF.curate,
  },
  {
    id: "U3d",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: `${CAST.aaron.name} and ${CAST.lisa.name} are going`,
    caption: "Number one is the same event. Friends going is the reason to get up and go.",
    path: eventPath,
  },
  {
    id: "P4",
    act: "pitch",
    persona: null,
    kind: "slide",
    slide: "build",
    video: "/demo/build.mp4",
    title: "How we built it",
    caption: "Five people, five agents, one shared board.",
  },
];

// The build slide's numbers, from the hub's kb/build-story. Refresh them right before
// the pitch (git shortlog on main, merged pull requests, test files, hub events).
export const BUILD_NUMBERS = {
  asOf: "Fri 1:00 AM",
  commits: 103,
  pullRequests: 50,
  testFiles: 47,
  hubActions: 667,
} as const;

/** The last beat of the organizer act: the stage loads the story event only after it. */
export const STORY_DUE_AFTER = BEATS.map((beat) => beat.act).lastIndexOf("organizer");
