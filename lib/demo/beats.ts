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
  // A film plays public/demo/films/<film>.mp4 full bleed, stepping through its
  // cue points; until the file exists it shows as a slide.
  kind: "slide" | "staged" | "app" | "film";
  title: string;
  // What the audience should take from this beat, shown large beside the phone.
  caption: string;
  // The screen to load in the phone: a real app path, or a staged screen's route.
  // Null while the beat waits for the story event.
  path?: (context: BeatContext) => string | null;
  staged?: StagedScreen;
  // A film beat's name: public/demo/films/<film>.mp4 and <film>.cues.json.
  film?: FilmName;
};

export type FilmName = "problem" | "muse" | "build";

/** Where a film beat's video and its cue points (an array of seconds) live. */
export function filmFiles(film: FilmName): { video: string; cues: string } {
  return { video: `/demo/films/${film}.mp4`, cues: `/demo/films/${film}.cues.json` };
}

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
    kind: "film",
    film: "problem",
    title: "The problem",
    caption: "Young adults open Facebook to get something done, like Marketplace. Events never gets a look.",
  },
  {
    id: "P2",
    act: "pitch",
    persona: null,
    kind: "film",
    film: "muse",
    title: "Muse does three jobs",
    caption: "It reads a post, knows your day, and brings you to the thing worth leaving for.",
  },
  {
    id: "O1",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-new-post",
    title: `${CAST.organizer.name}'s club is hosting tonight`,
    caption: "She posts the flyer on Instagram, the way she always does.",
    path: ({ now }) => HANDOFF.instagramPost(now.toISOString()),
  },
  {
    id: "O2",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-crosspost-prompt",
    title: "Instagram notices it's an event",
    caption: "It asks one question: want this on Facebook Events too?",
    path: ({ now }) => HANDOFF.instagramPost(now.toISOString()),
  },
  {
    id: "O3",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "Muse reads the flyer",
    caption: "The date, the place, the free food, who can come. All from the post.",
    path: ({ now }) => HANDOFF.organizerAt(now.toISOString()),
  },
  {
    id: "O5",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "It's live in one tap",
    caption: `A real Facebook event. ${CAST.organizer.name} typed nothing.`,
    path: ({ now }) => HANDOFF.organizerPosted(now.toISOString()),
  },
  {
    id: "U1a",
    act: "user1",
    persona: null,
    kind: "staged",
    staged: "live-activity",
    title: `${CAST.aaron.name} just got out of class`,
    caption: "Muse knows he's free and hungry.",
    path: ({ now }) => `${LIVE_ACTIVITY_PATH}?time=${encodeURIComponent(now.toISOString())}`,
  },
  {
    id: "U1b",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Already mapped",
    caption: "The best free stop on his walk home, before he asks.",
    path: ({ now }) => HANDOFF.walkHome(now.toISOString()),
  },
  {
    id: "U1c",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Change of plans",
    caption: `He says it out loud: I'm meeting ${CAST.lisa.name}. Muse finds a spot between them and invites her.`,
    path: ({ now }) => HANDOFF.replanLisa(now.toISOString()),
  },
  {
    id: "U2a",
    act: "lisa",
    persona: "lisa",
    kind: "staged",
    staged: "invite-message",
    title: `${CAST.lisa.name} gets the invite`,
    caption: `From ${CAST.aaron.name}'s Muse, in her Instagram messages.`,
    path: () => "/demo/instagram/dm",
  },
  {
    id: "U2b",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: `${CAST.lisa.name} isn't on Facebook`,
    caption: "She has Instagram, so she already has a Meta account.",
    path: lisaLandingPath,
  },
  {
    id: "U2c",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "She's in",
    caption: `No form, no password. And ${CAST.aaron.name} knows she's coming.`,
    // The same landing as U2b, so it stays on her "you're going" screen.
    path: lisaLandingPath,
  },
  {
    id: "U3a",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-feed-prompt",
    title: "Scrolling Instagram",
    caption: "A club they follow posted the same event.",
    path: () => "/demo/instagram/feed",
  },
  {
    id: "U3b",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "First time in Events",
    caption: "Muse builds the feed from what they already follow.",
    path: () => HANDOFF.curateAuto,
  },
  {
    id: "U3d",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "Who's going?",
    caption: `${CAST.aaron.name} and ${CAST.lisa.name}. So they go too.`,
    path: eventPath,
  },
  {
    id: "P4",
    act: "pitch",
    persona: null,
    kind: "film",
    film: "build",
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
