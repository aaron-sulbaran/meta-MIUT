import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { STORY_ORGANIZER } from "@/lib/demo/story-data";
import { eventTopics } from "@/lib/muse/candidates";
import { EVERYONE, FRIENDS, OPEN_NOTES, PEOPLE, mutualFriends } from "@/lib/social/fixtures/people";
import type { GoingPerson, WhoIsGoing } from "@/lib/social/types";
import { loadState, saveState } from "@/lib/store/state";

export { friendsGoingLine, friendsNamesLine, sharedLine, type GoingPerson, type WhoIsGoing } from "@/lib/social/types";

export const COMPANY_LIMIT = 5;

// Going together: who is going to an event, friends first, then students who
// marked Going and opted in to company: the top 5 by interests shared with
// the viewer. Friends going never change how events rank. Friends see you are going; others see you only on events where you
// opted in, and only your first name, year, major and shared interests. An
// Instagram handle is shown to friends, or to both sides once a hello is
// accepted. Fixture students opted in, so they accept a few seconds after a hi.

export type GoingEntry = { open: boolean; note?: string };

/** How long a fixture student takes to accept a hi, so the demo shows it pending first. */
export const ACCEPT_AFTER_MS = 4000;

/** Hellos by key, with when they were sent, and the line Muse wrote for each. */
type SocialState = { going: Map<string, Map<string, GoingEntry>>; hellos: Map<string, number>; notes: Map<string, string> };

const globalForSocial = globalThis as unknown as { __socialState?: SocialState };
function state(): SocialState {
  globalForSocial.__socialState ??= { going: new Map(), hellos: new Map(), notes: new Map() };
  return globalForSocial.__socialState;
}

/** The event the demo follows (lib/demo/story-data.ts): its going list is set for the ending. */
function isStoryEvent(event: CampusEvent): boolean {
  return event.organizer.handle.toLowerCase() === STORY_ORGANIZER.handle;
}

// The story's ending: Trish knows nobody going, and the people open to company are
// Lisa (she turns it on in her act) and Jolyn, seeded here as going and open.
const STORY_COMPANY: [string, GoingEntry][] = [["sample-student", { open: true, note: "Going after class, happy to share a table" }]];

/** FNV-1a with a final mix, so similar ids (evt-test-a, evt-test-b) still roll differently. */
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

const DEMO_FRIENDS = new Set(Object.values(FRIENDS).flat());

/** Students from campus going who are not in the fixtures, so counts look like a real event: 25 to 88, stable per event. */
export function crowdAt(eventId: string): number {
  return 25 + (hash(`crowd@${eventId}`) % 64);
}

/**
 * Fixture students go to events that match their interests, picked by a stable hash. The demo's own people never are.
 * Friends go less often, so each event names a different one or two of them instead of the same faces everywhere.
 */
function seedGoing(event: CampusEvent): Map<string, GoingEntry> {
  const topics = new Set(eventTopics(event));
  const story = isStoryEvent(event);
  const going = new Map<string, GoingEntry>(story ? STORY_COMPANY : []);
  for (const person of PEOPLE) {
    if (!person.interests.some((interest) => topics.has(interest))) continue;
    // On the story event none of Trish's friends go, and the crowd is not looking for company.
    if (story && FRIENDS.user3?.includes(person.id)) continue;
    const roll = hash(`${person.id}@${event.id}`);
    if (DEMO_FRIENDS.has(person.id) ? roll % 3 !== 0 : roll % 4 === 0) continue;
    const open = !story && roll % 3 !== 0;
    going.set(person.id, open ? { open, note: OPEN_NOTES[roll % OPEN_NOTES.length] } : { open });
  }
  return going;
}

function goingAt(event: CampusEvent): Map<string, GoingEntry> {
  const all = state().going;
  let going = all.get(event.id);
  if (!going) {
    going = seedGoing(event);
    all.set(event.id, going);
  }
  return going;
}

const helloKey = (eventId: string, from: string, to: string) => `${eventId}|${from}|${to}`;

export function whoIsGoing(event: CampusEvent, viewerId: string, viewerInterests: string[], now = Date.now()): WhoIsGoing {
  const going = goingAt(event);
  const friendIds = new Set(FRIENDS[viewerId] ?? []);
  const mine = new Set(viewerInterests.map((interest) => interest.toLowerCase()));
  const friends: GoingPerson[] = [];
  const openToCompany: GoingPerson[] = [];
  let othersCount = crowdAt(event.id);

  for (const [personId, entry] of going) {
    if (personId === viewerId) continue;
    const person = EVERYONE.find((candidate) => candidate.id === personId);
    if (!person) {
      othersCount += 1;
      continue;
    }
    const shared = person.interests.filter((interest) => mine.has(interest));
    const base = { id: person.id, name: person.name, year: person.year, major: person.major, shared };
    if (friendIds.has(personId)) {
      friends.push({ ...base, instagram: person.instagram });
    } else if (entry.open && shared.length > 0) {
      const sentAt = state().hellos.get(helloKey(event.id, viewerId, personId));
      const hello = sentAt === undefined ? undefined : now - sentAt >= ACCEPT_AFTER_MS ? ("accepted" as const) : ("pending" as const);
      const mutual = mutualFriends(viewerId, personId);
      openToCompany.push({
        ...base,
        ...(mutual.length > 0 ? { mutual } : {}),
        note: entry.note,
        ...(hello ? { hello } : {}),
        ...(hello === "accepted" ? { instagram: person.instagram } : {}),
      });
    } else {
      othersCount += 1;
    }
  }

  // A different friend leads at each event, not whoever is first in the fixture.
  friends.sort((a, b) => hash(`${a.id}@${event.id}`) - hash(`${b.id}@${event.id}`));
  openToCompany.sort((a, b) => b.shared.length - a.shared.length || a.name.localeCompare(b.name));
  othersCount += Math.max(0, openToCompany.length - COMPANY_LIMIT);
  const self = going.get(viewerId);
  const shownCompany = openToCompany.slice(0, COMPANY_LIMIT);
  return {
    eventId: event.id,
    friends,
    openToCompany: shownCompany,
    othersCount,
    goingCount: friends.length + shownCompany.length + othersCount + (self ? 1 : 0),
    viewer: { going: self !== undefined, open: self?.open ?? false, ...(self?.note ? { note: self.note } : {}) },
  };
}

export function setGoing(event: CampusEvent, viewerId: string, update: { going: boolean; open?: boolean; note?: string }) {
  const going = goingAt(event);
  if (!update.going) {
    going.delete(viewerId);
    return;
  }
  // Marked going without a word on company (an accepted invite) keeps what they had chosen.
  const before = going.get(viewerId);
  const open = update.open ?? before?.open ?? false;
  const note = update.note ?? (update.open === undefined ? before?.note : undefined);
  going.set(viewerId, { open, ...(open && note ? { note } : {}) });
}

/**
 * The viewer says hi to a student who is open to company. Fixture students
 * opted in, so they say yes ACCEPT_AFTER_MS later and handles are swapped.
 */
// A recorded line (Muse unreachable) is kept with this mark, so every screen labels it the same way.
const RECORDED = "recorded:";
const noteText = (note: string | undefined) => (note === undefined ? null : note.startsWith(RECORDED) ? note.slice(RECORDED.length) : note);
const noteRecorded = (note: string | undefined) => note?.startsWith(RECORDED) === true;

export function sayHello(
  event: CampusEvent,
  viewerId: string,
  toId: string,
  now = Date.now(),
  message?: string,
  recorded = false,
): { error: string | null } {
  const entry = goingAt(event).get(toId);
  if (!entry?.open) return { error: "They are not looking for company at this event" };
  const key = helloKey(event.id, viewerId, toId);
  if (!state().hellos.has(key)) state().hellos.set(key, now);
  if (message) state().notes.set(key, recorded ? `${RECORDED}${message}` : message);
  return { error: null };
}

export type HelloSent = { to: string; message: string | null; recorded: boolean; at: number };

/** The hellos this viewer sent at this event, oldest first (the page shows a hi sent from another screen). */
export function hellosFrom(eventId: string, viewerId: string): HelloSent[] {
  return [...state().hellos.entries()]
    .map(([key, at]) => ({ key, at, parts: key.split("|") }))
    .filter(({ parts }) => parts[0] === eventId && parts[1] === viewerId)
    .map(({ key, at, parts }) => ({ to: parts[2]!, message: noteText(state().notes.get(key)), recorded: noteRecorded(state().notes.get(key)), at }))
    .sort((first, second) => first.at - second.at);
}

export type HelloReceived = { eventId: string; from: string; message: string | null; at: number };

/** The hellos someone has been sent, newest first (their phone shows "Trish said hi"). */
export function hellosTo(personId: string): HelloReceived[] {
  return [...state().hellos.entries()]
    .map(([key, at]) => ({ key, at, parts: key.split("|") }))
    .filter(({ parts }) => parts[2] === personId)
    .map(({ key, at, parts }) => ({ eventId: parts[0]!, from: parts[1]!, message: noteText(state().notes.get(key)), at }))
    .sort((first, second) => second.at - first.at);
}

const EntriesSchema = z.array(z.tuple([z.string(), z.object({ open: z.boolean(), note: z.string().optional() })]));
const goingName = (eventId: string) => `social-going:${eventId}`;
const HELLOS = "social-hellos";
// Starts with "social-hellos", so the demo reset clears it with the hellos.
const HELLO_NOTES = "social-hellos-notes";

/** Going lists for these events and accepted hellos, as last saved in the shared store (Redis). */
export async function loadSocial(eventIds: string[]): Promise<void> {
  const [notes, hellos, ...lists] = await Promise.all([
    loadState(HELLO_NOTES, z.array(z.tuple([z.string(), z.string()]))),
    // Hellos saved before the pending step were plain keys, already accepted.
    loadState(HELLOS, z.array(z.union([z.string(), z.tuple([z.string(), z.number()])]))),
    ...eventIds.map((id) => loadState(goingName(id), EntriesSchema)),
  ]);
  if (hellos) state().hellos = new Map(hellos.map((hello) => (typeof hello === "string" ? [hello, 0] : hello)));
  if (notes) state().notes = new Map(notes);
  eventIds.forEach((id, index) => {
    const entries = lists[index];
    if (entries) state().going.set(id, new Map(entries));
  });
}

export async function saveSocial(event: CampusEvent): Promise<void> {
  await Promise.all([
    saveState(goingName(event.id), [...goingAt(event).entries()]),
    saveState(HELLOS, [...state().hellos.entries()]),
    saveState(HELLO_NOTES, [...state().notes.entries()]),
  ]);
}

export function resetSocial() {
  delete globalForSocial.__socialState;
}
