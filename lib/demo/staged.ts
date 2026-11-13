import { CAMPUS_TIME_ZONE } from "@/lib/brand";

// The staged screens of the demo (hub t-y329): screens that imitate another
// app (an Instagram post, an Instagram message, an Instagram feed), live only
// under /demo/instagram, and hand off into the real app with one tap. Client
// safe. Facebook's own chrome (tab bar, alert banners, the nearby opt-in)
// stays off these screens.

export const STAGED_PREFIX = "/demo/instagram";

/** True on a staged screen, where Facebook's chrome must not show. */
export function isStagedScreen(pathname: string | null): boolean {
  return pathname !== null && (pathname === STAGED_PREFIX || pathname.startsWith(`${STAGED_PREFIX}/`));
}

// The one event the demo follows, as the organizer posts it. Matches the
// story (lib/demo/story.ts): same title, club, place, food, and a start about
// 25 minutes after the demo clock.
export const STORY_POST = {
  title: "Board Game Night",
  organizer: { name: "MIT Board Game Club", handle: "mit_boardgames" },
  placeName: "MIT Museum, 314 Main St",
  foodNote: "Dumplings",
  startsInMinutes: 25,
  durationMinutes: 120,
} as const;

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

/** Where each staged screen hands off into the real app. One place, so a route change is one line. */
export const HANDOFF = {
  // O3: the organizer flow drafts the story flyer with a real Muse call, no file picker.
  organizer: "/organizer?handoff=story",
  // U2b: the first builder's no-account landing (t-1lup); until it names its URL, the event with who invited.
  lisaLanding: (eventId: string, inviter: string) => `/events/${encodeURIComponent(eventId)}?invite=${encodeURIComponent(inviter)}`,
  // U3b: the first builder's curate screen (t-s8eh); the Events tab until it names its URL.
  curate: "/",
} as const;

/** The flyer image, drawn for the demo clock (app/demo/flyer.png). */
export function flyerUrl(now: Date): string {
  return `/demo/flyer.png?at=${encodeURIComponent(now.toISOString())}`;
}
