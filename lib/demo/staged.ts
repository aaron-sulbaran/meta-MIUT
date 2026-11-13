import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { STORY, STORY_ORGANIZER } from "@/lib/demo/story-data";

// The staged screens of the demo (hub t-y329): screens that imitate another
// app (an Instagram post, an Instagram message, an Instagram feed, a phone's
// lock screen with a Live Activity), live only under /demo, and hand off into
// the real app with one tap. Client
// safe. Facebook's own chrome (tab bar, alert banners, the nearby opt-in)
// stays off these screens.

export const STAGED_PREFIX = "/demo/instagram";
// U1a: Aaron's lock screen with the class-ended Live Activity.
export const LIVE_ACTIVITY_PATH = "/demo/live-activity";
const STAGED_ROOTS = [STAGED_PREFIX, LIVE_ACTIVITY_PATH];

/** True on a staged screen, where Facebook's chrome must not show. */
export function isStagedScreen(pathname: string | null): boolean {
  return pathname !== null && STAGED_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

// The one event the demo follows, as the organizer posts it: the story's own
// data (lib/demo/story-data.ts), so the flyer, the post, and the event match.
export const STORY_POST = { ...STORY, organizer: STORY_ORGANIZER } as const;

const MINUTE_MS = 60_000;

/** Start and end of the story event on the flyer: 25 minutes out, on the next 5 minutes. */
export function storyTimes(now: Date): { start: Date; end: Date } {
  const step = 5 * MINUTE_MS;
  const start = new Date(Math.ceil((now.getTime() + STORY_POST.startsInMinutes * MINUTE_MS) / step) * step);
  return { start, end: new Date(start.getTime() + STORY_POST.durationMinutes * MINUTE_MS) };
}

function clock(date: Date, withPeriod: boolean): string {
  const text = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
  return withPeriod ? text : text.replace(/\s?[AP]M$/, "");
}

/** "5:30 to 7:30 PM", as the flyer and the caption say it. */
export function storyTimeLine(now: Date): string {
  const { start, end } = storyTimes(now);
  return `${clock(start, false)} to ${clock(end, true)}`;
}

/** The organizer's Instagram caption, with today's times. */
export function storyCaption(now: Date): string {
  return `Board Game Night today at the MIT Museum (314 Main St), ${storyTimeLine(now)}: free dumplings while they last and 40 board games. Open to everyone, no experience needed. Come by after class!`;
}

/**
 * Where each staged screen hands off into the real app: the /demo stage's next
 * beat paths (lib/demo/beats.ts). They must match exactly, or the stage reloads
 * the phone (and the organizer's Muse call would run twice).
 */
const ORGANIZER_HANDOFF = "/organizer?handoff=story";
const withClock = (path: string, atIso: string | null) => (atIso ? `${path}${path.includes("?") ? "&" : "?"}at=${encodeURIComponent(atIso)}` : path);

export const HANDOFF = {
  // O1 to O2: the post stays on screen, on the demo clock (?at=) so its flyer
  // and the organizer's draft show the same times.
  instagramPost: (atIso: string | null) => withClock(`${STAGED_PREFIX}/post`, atIso),
  // O3 on the same clock as the post.
  organizerAt: (atIso: string | null) => withClock(ORGANIZER_HANDOFF, atIso),
  // U1b: the map with Muse's walk home planned from the demo clock (?time= pins it).
  walkHome: (timeIso: string) => `/?plan=home&time=${encodeURIComponent(timeIso)}`,
  // O3: the organizer flow drafts the story flyer with a real Muse call, no file picker.
  organizer: ORGANIZER_HANDOFF,
  // U2b: the no-account landing (t-1lup).
  lisaLanding: (eventId: string, inviter: string) => `/invite/${encodeURIComponent(eventId)}?from=${encodeURIComponent(inviter)}`,
  // U3b: the curate step (t-s8eh).
  curate: "/curate",
} as const;

/**
 * Hand off into the real app: go to `path`, and when this screen runs inside the
 * /demo stage's phone, tell the stage, so it moves to the next beat without
 * reloading the phone.
 */
export function handOff(path: string, go: (path: string) => void) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage({ type: "demo-handoff", path }, window.location.origin);
  }
  go(path);
}

/** The flyer image, drawn for the demo clock (app/demo/flyer.png). */
export function flyerUrl(now: Date): string {
  return `/demo/flyer.png?at=${encodeURIComponent(now.toISOString())}`;
}
