import { HANDOFF, LIVE_ACTIVITY_PATH, REPLAN_LINE } from "@/lib/demo/staged";
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
  | "instagram-feed-prompt"
  | "instagram-reels";

// A message the stage posts into a phone still on the screen a beat continues from:
// U1c asks Muse over the walk home; Trish's Reels beats move to the next reel or open the sheet.
export type InFrameMessage = { type: "demo-ask"; line: string } | { type: "demo-reel"; reel: number; sheet?: boolean };

// now is the run's clock: stamped when the first live beat opens, so every
// screen (the flyer, the organizer's draft, the walk home) shows the same
// times. storyEventId is null until the organizer act is over (or skipped): the stage
// creates the story event only then, so Muse sees no earlier copy at O3 and
// the organizer publishes a new event instead of updating one.
export type BeatContext = { storyEventId: string | null; now: Date };

export type Beat = {
  id: string;
  act: BeatAct;
  // Null plays User 1, the sample student (no cookie).
  persona: PersonaId | null;
  // A deck is a live motion page (public/demo/deck/<deck>/index.html) stepped by
  // the stage; a film plays public/demo/films/<film>.mp4 stepping through its cue
  // points (a rendered backup for a deck). With neither file, `sections` show as
  // plain slides, one per cue.
  kind: "slide" | "staged" | "app" | "film" | "deck";
  title: string;
  // What the audience should take from this beat, shown large beside the phone.
  caption: string;
  // The screen to load in the phone: a real app path, or a staged screen's route.
  // Null while the beat waits for the story event.
  path?: (context: BeatContext) => string | null;
  staged?: StagedScreen;
  // A film beat's name: public/demo/films/<film>.mp4 and <film>.cues.json.
  film?: FilmName;
  // A deck beat's name: public/demo/deck/<deck>/index.html, notes in steps.json beside it.
  deck?: DeckName;
  // The opening's sections, in order: each one cue of the deck or film. `line` is
  // the fallback slide (the section's one bold line), `note` what the presenter says.
  sections?: { name: string; line: string; note: string }[];
  // What the presenter says and does on this beat. On the remote and the console only.
  note?: string;
  // Continues inside the phone of beat `from` (when it is still on screen) by posting
  // `message` to it, instead of loading this beat's path. Any other way in loads the path.
  inFrame?: { from: string; message: InFrameMessage };
  // Load this beat's screen hidden while the beat before it is on (same person),
  // so it is already at rest when the presenter moves on.
  prefetch?: boolean;
  // The screen loaded ahead, when it differs from `path`: it plans hidden and shows its
  // work only when the stage posts {source: "demo-stage", type: "reveal"} as it appears.
  prefetchPath?: (context: BeatContext) => string | null;
};

export type FilmName = "problem" | "muse" | "build";
export type DeckName = "problem" | "muse";

/** Where a deck beat's page lives. */
export function deckPath(deck: DeckName): string {
  return `/demo/deck/${deck}/index.html`;
}

/** A deck's presenter notes: an ordered array of {id, title, notes}, one per step. */
export function deckStepsPath(deck: DeckName): string {
  return `/demo/deck/${deck}/steps.json`;
}

export type DeckStep = { id: string; title: string; notes: string };

/** Where a film beat's video and its cue points (an array of seconds) live. */
export function filmFiles(film: FilmName): { video: string; cues: string } {
  return { video: `/demo/films/${film}.mp4`, cues: `/demo/films/${film}.cues.json` };
}

// The cast, in one place (Aaron's final cast, 2026-11-13). Aaron presents and is
// not in the skit. User 1 is the sample student (no persona cookie).
export type CastId = "organizer" | "user1" | "user2" | "user3";

export const CAST: Record<CastId, { name: string; role: string }> = {
  organizer: { name: "Jing", role: "Event Organizer" },
  user1: { name: "Jolyn", role: "Facebook Events Power User" },
  user2: { name: "Lisa", role: "New to Facebook" },
  user3: { name: "Trish", role: "New to Facebook Events" },
};

/** Each cast member's phone link slug: /demo/phone/<slug>. */
export const CAST_SLUG: Record<CastId, string> = {
  organizer: "jing",
  user1: "jolyn",
  user2: "lisa",
  user3: "trish",
};

// The persona cookie each cast member plays (null is the sample student). Cookie values stay as they were.
const CAST_OF_PERSONA: Record<PersonaId, CastId> = { organizer: "organizer", lisa: "user2", user3: "user3" };

/** The cast member a persona plays (no persona is User 1, the sample student). */
export function castOf(persona: PersonaId | null): CastId {
  return persona ? CAST_OF_PERSONA[persona] : "user1";
}

/** "Lisa · New to Facebook". */
export function castLine(id: CastId): string {
  return `${CAST[id].name} · ${CAST[id].role}`;
}

// Which cast member each act follows, in the order the show meets them.
export const ACT_CAST: Record<Exclude<BeatAct, "pitch">, CastId> = {
  organizer: "organizer",
  user1: "user1",
  lisa: "user2",
  user3: "user3",
};

export const ACT_LABELS: Record<BeatAct, string> = {
  pitch: "The pitch",
  organizer: castLine("organizer"),
  user1: castLine("user1"),
  lisa: castLine("user2"),
  user3: castLine("user3"),
};

const whosGoingPath = ({ storyEventId }: BeatContext) => (storyEventId ? HANDOFF.whosGoing(storyEventId) : null);
const lisaJoinedPath = ({ storyEventId }: BeatContext) => (storyEventId ? HANDOFF.lisaJoined(storyEventId, "sample-student") : null);
const lisaLandingPath = ({ storyEventId }: BeatContext) => (storyEventId ? HANDOFF.lisaLanding(storyEventId, "sample-student") : null);
const lisaStepPath =
  (step: "account" | "ready" | "event") =>
  ({ storyEventId }: BeatContext) =>
    storyEventId ? HANDOFF.lisaStep(storyEventId, "sample-student", step) : null;

export const BEATS: Beat[] = [
  // The opening follows Jolyn's script (hub sources/2026-11-13-jolyn-opening-pitch-script.md).
  // It will be trimmed for time: the structure is wired, the words are hers and change there.
  {
    id: "P1",
    act: "pitch",
    persona: null,
    kind: "deck",
    deck: "problem",
    film: "problem",
    title: "The problem",
    caption: "We need a reason to open the app.",
    // Fallback lines only from the confirmed list (no survey replies); the deck replaces them.
    sections: [
      {
        name: "The hook",
        line: "What would get you back on Facebook?",
        note: "We started with a simple question. We asked 50 Gen Z students: what would actually get you back on Facebook? And the responses were pretty brutal: \"Nothing.\" \"It's beyond saving.\" \"If the love of my life was only on Facebook.\"",
      },
      {
        name: "Marketplace",
        line: "But there was one exception. Marketplace.",
        note: "But there was one exception: Facebook Marketplace. As Gen Z, we don't go on Facebook to scroll. We go to get something done. It's an app to do.",
      },
      {
        name: "Campus flyers",
        line: "We don't need another feed to scroll. We need a reason to open the app.",
        note: "Every day, clubs and departments host events and give away free food. Things we'd actually want to go to.",
      },
      {
        name: "Overload",
        line: "The opportunities exist. We just can't find them.",
        note: "But it's scattered across emails, Instagram posts, and group chats. By the time we hear about it, it's already over.",
      },
      {
        name: "The solution",
        line: "What if finding your next experience was as easy as finding your next deal?",
        note: "Marketplace made Facebook useful for finding things. So what if finding your next experience was as easy as finding your next deal?",
      },
    ],
  },
  {
    id: "P2",
    act: "pitch",
    persona: null,
    kind: "deck",
    deck: "muse",
    film: "muse",
    title: "How Muse makes it possible",
    caption: "Less work for organizers. Less searching for students.",
    sections: [
      {
        name: "Muse reads the post",
        line: "Events, reimagined.",
        note: "Organizers already post on Instagram, so why post twice? With one share, Muse reads the post and makes the Facebook event. For students, Muse surfaces what fits their interests, place, and schedule.",
      },
      {
        name: "Over to the skit",
        line: "Less work for organizers. Less searching for students.",
        note: "Less work for organizers. Less searching for students. Let's see it.",
      },
    ],
  },
  {
    id: "O1",
    act: "organizer",
    persona: "organizer",
    kind: "staged",
    staged: "instagram-new-post",
    title: `${CAST.organizer.name}'s club is hosting tonight`,
    caption: "She posts the flyer on Instagram, the way she always does.",
    note: "Jing: show the club's Instagram post with the flyer and caption. Tap Share.",
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
    note: "Jing: Instagram asks to post it to Facebook Events too. Tap yes.",
    path: ({ now }) => HANDOFF.instagramPost(now.toISOString()),
  },
  {
    id: "O3",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "Muse reads the flyer",
    caption: "The date, the place, the free food, who can come. All from the post.",
    note: "Jing: let Muse fill the fields from the flyer, live. Point at the date, place, and free food.",
    path: ({ now }) => HANDOFF.organizerAt(now.toISOString()),
  },
  {
    id: "O5",
    act: "organizer",
    persona: "organizer",
    kind: "app",
    title: "It's live in one tap",
    caption: `A real Facebook event. ${CAST.organizer.name} typed nothing.`,
    note: "Jing: tap Post. It is a real Facebook event now.",
    path: ({ now }) => HANDOFF.organizerPosted(now.toISOString()),
  },
  {
    id: "U1a",
    act: "user1",
    persona: null,
    kind: "staged",
    staged: "live-activity",
    title: `${CAST.user1.name} just got out of class`,
    caption: "Muse knows she's free and hungry.",
    note: "Jolyn: class just ended. Read the Live Activity out loud, then tap it.",
    path: ({ now }) => `${LIVE_ACTIVITY_PATH}?time=${encodeURIComponent(now.toISOString())}`,
  },
  {
    id: "U1b",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Already mapped",
    caption: "The best free stop on her walk home, before she asks.",
    note: "Jolyn: the walk home is already mapped. Point at the free stop on the way.",
    path: ({ now }) => HANDOFF.walkHome(now.toISOString()),
    // Planned while the lock screen is up; Muse's reveal plays when the beat appears, not hidden.
    prefetch: true,
    prefetchPath: ({ now }) => HANDOFF.walkHomeHeld(now.toISOString()),
  },
  {
    id: "U1c",
    act: "user1",
    persona: null,
    kind: "app",
    title: "Change of plans",
    caption: `She says it out loud: I'm meeting ${CAST.user2.name}. Muse finds a spot between them and invites her.`,
    note: "Jolyn: say it out loud: I'm meeting Lisa, find something between us and invite her. Wait for the invite line on the plan.",
    path: ({ now }) => HANDOFF.replanLisa(now.toISOString()),
    // Coming from U1b, Ask Muse opens over the walk already on screen: no reload, no second plan.
    inFrame: { from: "U1b", message: { type: "demo-ask", line: REPLAN_LINE } },
  },
  {
    id: "U2a",
    act: "lisa",
    persona: "lisa",
    kind: "staged",
    staged: "invite-message",
    title: `${CAST.user2.name} gets the invite`,
    caption: `From ${CAST.user1.name}'s Muse, in her Instagram messages.`,
    note: "Lisa: the invite arrives in her Instagram messages. Tap the event card.",
    path: () => "/demo/instagram/dm",
  },
  {
    id: "U2b",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: `${CAST.user2.name} isn't on Facebook`,
    caption: `Facebook opens on ${CAST.user1.name}'s invite. The title shows; the rest needs an account.`,
    note: "Lisa: watch Facebook open. Read the title out loud: board game night, and free dumplings. But I'm not on Facebook. Tap Create Facebook account.",
    path: lisaLandingPath,
  },
  {
    id: "U2c",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "Her Meta account is already here",
    caption: "She has Instagram, so she already has a Meta account.",
    note: "Lisa: Meta already knows me from Instagram. Tap Continue.",
    path: lisaStepPath("account"),
  },
  {
    id: "U2d",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "Facebook account ready",
    caption: "Her name and photo came over from Instagram. No form, no password.",
    note: "Lisa: that's it, I have a Facebook account. Tap See the event.",
    path: lisaStepPath("ready"),
  },
  {
    id: "U2e",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "Now she sees it all",
    caption: "The time, the place, who's going. She decides.",
    note: "Lisa: now I can see when and where. Tap Join.",
    path: lisaStepPath("event"),
  },
  {
    id: "U2f",
    act: "lisa",
    persona: "lisa",
    kind: "app",
    title: "She's going",
    caption: `${CAST.user1.name} knows she's coming. And she's open to meeting people.`,
    note: "Lisa: I'm going, and Jolyn knows. Turn on Open to company: that hands over to Trish.",
    // Her landing already joined, so the beat rests on the event even if the steps before were skipped.
    path: lisaJoinedPath,
  },
  // Trish scrolls Reels on her own phone: each swipe is a beat, so the stage follows her
  // reel by reel without reloading (inFrame). The prompt comes only on the third reel.
  {
    id: "U3a1",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-reels",
    title: "Scrolling Reels",
    caption: "Trish has a Facebook account. She just never opens it.",
    note: "Trish: you're on Reels, like any night. Swipe up to the next one.",
    path: () => HANDOFF.reels(1),
  },
  {
    id: "U3a2",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-reels",
    title: "Still scrolling",
    caption: "Her friends' world lives here, not on Facebook.",
    note: "Trish: keep it moving. Swipe up again.",
    path: () => HANDOFF.reels(2),
    inFrame: { from: "U3a1", message: { type: "demo-reel", reel: 2 } },
  },
  {
    id: "U3a3",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-reels",
    title: "A club she follows",
    caption: "The reel keeps playing. A small prompt slides in.",
    note: "Trish: the Board Game Club's reel. Wait for the pill above the audio line, then tap it.",
    path: () => HANDOFF.reels(3),
    inFrame: { from: "U3a2", message: { type: "demo-reel", reel: 3 } },
  },
  {
    id: "U3a4",
    act: "user3",
    persona: "user3",
    kind: "staged",
    staged: "instagram-reels",
    title: "Check this out on Facebook Events?",
    caption: "One tap from a reel to the event, no new account.",
    note: "Trish: read the sheet, then tap Open Facebook Events.",
    path: () => HANDOFF.reels(3, true),
    inFrame: { from: "U3a3", message: { type: "demo-reel", reel: 3, sheet: true } },
  },
  {
    id: "U3b",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "First time in Events",
    caption: "Muse builds the feed from what she already follows.",
    note: "Trish: first time in Events. Muse reads what she follows and builds her feed. Board Game Night is first.",
    path: () => HANDOFF.curateAuto,
  },
  {
    id: "U3d",
    act: "user3",
    persona: "user3",
    kind: "app",
    title: "Who's going?",
    caption: `${CAST.user1.name} and ${CAST.user2.name}. So she goes too.`,
    note: "Trish: Jolyn and Lisa are going, and Muse suggests who to say hi to. She taps I'm going.",
    path: whosGoingPath,
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
