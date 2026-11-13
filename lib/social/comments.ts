import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { PEOPLE } from "@/lib/social/fixtures/people";
import type { EventComment, EventComments } from "@/lib/social/comment-types";
import { loadState, saveState } from "@/lib/store/state";

export { COMMENT_MAX_LENGTH, type EventComment, type EventComments } from "@/lib/social/comment-types";

// Event comments: what people are saying about an event, the demo's stand-in
// for live photo status. Sample comments from the fixture students are
// pinned to the event's own times (before, during, after) and only show once
// that time has passed, so a live event reads live. Viewer comments are kept
// in the process, and in the shared store (Redis) when it is configured.

type Stored = { id: string; authorId: string; name: string; text: string; at: string };
type CommentsState = { posted: Map<string, Stored[]> };

const globalForComments = globalThis as unknown as { __commentsState?: CommentsState };
function state(): CommentsState {
  globalForComments.__commentsState ??= { posted: new Map() };
  return globalForComments.__commentsState;
}

const MINUTE = 60_000;

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

type Phase = "before" | "during" | "after";
type Sample = { phase: Phase; minutes: number; text: (event: CampusEvent) => string; food?: boolean };

const foodName = (event: CampusEvent) => (event.foodNote?.trim() || "food").toLowerCase();

// Minutes are from the start (before, during) or the end (after).
const SAMPLES: Sample[] = [
  { phase: "before", minutes: -26 * 60, text: () => "Anyone else going? Would be fun to go as a group." },
  { phase: "before", minutes: -3 * 60, text: () => "Is this open to students from other schools?" },
  { phase: "before", minutes: -50, text: () => "Heading over in a bit, see some of you there." },
  { phase: "before", minutes: -90, food: true, text: (event) => `Do they usually run out of ${foodName(event)} early?` },
  { phase: "during", minutes: 10, text: () => "Just got here, still plenty of seats." },
  { phase: "during", minutes: 25, food: true, text: (event) => `Still lots of ${foodName(event)} left, come by.` },
  { phase: "during", minutes: 40, text: () => "Pretty packed now, the line moves fast though." },
  { phase: "during", minutes: 55, food: true, text: (event) => `${foodName(event).replace(/^./, (c) => c.toUpperCase())} is almost gone.` },
  { phase: "after", minutes: 15, text: () => "That was great, thanks to the organizers." },
  { phase: "after", minutes: 30, text: () => "Hope they do this again next month." },
];

function sampleComments(event: CampusEvent, now: Date): Stored[] {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const comments: Stored[] = [];
  SAMPLES.forEach((sample, index) => {
    if (sample.food && !event.food) return;
    const roll = hash(`${event.id}#${index}`);
    if (roll % 3 === 0) return;
    const base = sample.phase === "after" ? end : start;
    const at = base + sample.minutes * MINUTE;
    if (sample.phase === "during" && at >= end) return;
    if (at > now.getTime()) return;
    const person = PEOPLE[roll % PEOPLE.length];
    if (!person) return;
    comments.push({ id: `sample-${index}`, authorId: person.id, name: person.name, text: sample.text(event), at: new Date(at).toISOString() });
  });
  return comments;
}

function posted(eventId: string): Stored[] {
  const all = state().posted;
  let list = all.get(eventId);
  if (!list) {
    list = [];
    all.set(eventId, list);
  }
  return list;
}

/** Everything said about the event so far, newest first. */
export function eventComments(event: CampusEvent, viewerId: string, now = new Date()): EventComments {
  const comments: EventComment[] = [...sampleComments(event, now), ...posted(event.id)]
    .map((comment) => ({ ...comment, mine: comment.authorId === viewerId }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { eventId: event.id, comments };
}

export function addComment(event: CampusEvent, viewer: { id: string; name: string }, text: string, now = new Date()): EventComment {
  const list = posted(event.id);
  const comment: Stored = { id: `c-${now.getTime().toString(36)}-${list.length}`, authorId: viewer.id, name: viewer.name, text, at: now.toISOString() };
  list.push(comment);
  return { ...comment, mine: true };
}

const StoredSchema = z.array(
  z.object({ id: z.string(), authorId: z.string(), name: z.string(), text: z.string(), at: z.string() }),
);
const commentsName = (eventId: string) => `social-comments:${eventId}`;

/** Viewer comments for this event, as last saved in the shared store (Redis). */
export async function loadComments(eventId: string): Promise<void> {
  const saved = await loadState(commentsName(eventId), StoredSchema);
  if (saved) state().posted.set(eventId, saved);
}

export async function saveComments(eventId: string): Promise<void> {
  await saveState(commentsName(eventId), posted(eventId));
}

export function resetComments() {
  delete globalForComments.__commentsState;
}
