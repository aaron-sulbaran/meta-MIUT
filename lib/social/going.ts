import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
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
// Instagram handle is shown to friends, or after a hello is accepted.

export type GoingEntry = { open: boolean; note?: string };

type SocialState = { going: Map<string, Map<string, GoingEntry>>; hellos: Set<string> };

const globalForSocial = globalThis as unknown as { __socialState?: SocialState };
function state(): SocialState {
  globalForSocial.__socialState ??= { going: new Map(), hellos: new Set() };
  return globalForSocial.__socialState;
}

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Fixture students go to events that match their interests, picked by a stable hash. The demo's own people never are. */
function seedGoing(event: CampusEvent): Map<string, GoingEntry> {
  const topics = new Set(eventTopics(event));
  const going = new Map<string, GoingEntry>();
  for (const person of PEOPLE) {
    if (!person.interests.some((interest) => topics.has(interest))) continue;
    const roll = hash(`${person.id}@${event.id}`);
    if (roll % 4 === 0) continue;
    const open = roll % 3 !== 0;
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

export function whoIsGoing(event: CampusEvent, viewerId: string, viewerInterests: string[]): WhoIsGoing {
  const going = goingAt(event);
  const friendIds = new Set(FRIENDS[viewerId] ?? []);
  const mine = new Set(viewerInterests.map((interest) => interest.toLowerCase()));
  const friends: GoingPerson[] = [];
  const openToCompany: GoingPerson[] = [];
  let othersCount = 0;

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
      const accepted = state().hellos.has(helloKey(event.id, viewerId, personId));
      const mutual = mutualFriends(viewerId, personId);
      openToCompany.push({
        ...base,
        ...(mutual.length > 0 ? { mutual } : {}),
        note: entry.note,
        ...(accepted ? { instagram: person.instagram, hello: "accepted" as const } : {}),
      });
    } else {
      othersCount += 1;
    }
  }

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
  if (!update.going) going.delete(viewerId);
  else going.set(viewerId, { open: update.open ?? false, ...(update.open && update.note ? { note: update.note } : {}) });
}

/**
 * The viewer says hi to a student who is open to company. Fixture students
 * opted in, so in the demo they say yes at once and handles are swapped.
 */
export function sayHello(event: CampusEvent, viewerId: string, toId: string): { error: string | null } {
  const entry = goingAt(event).get(toId);
  if (!entry?.open) return { error: "They are not looking for company at this event" };
  state().hellos.add(helloKey(event.id, viewerId, toId));
  return { error: null };
}

const EntriesSchema = z.array(z.tuple([z.string(), z.object({ open: z.boolean(), note: z.string().optional() })]));
const goingName = (eventId: string) => `social-going:${eventId}`;
const HELLOS = "social-hellos";

/** Going lists for these events and accepted hellos, as last saved in the shared store (Redis). */
export async function loadSocial(eventIds: string[]): Promise<void> {
  const [hellos, ...lists] = await Promise.all([
    loadState(HELLOS, z.array(z.string())),
    ...eventIds.map((id) => loadState(goingName(id), EntriesSchema)),
  ]);
  if (hellos) state().hellos = new Set(hellos);
  eventIds.forEach((id, index) => {
    const entries = lists[index];
    if (entries) state().going.set(id, new Map(entries));
  });
}

export async function saveSocial(event: CampusEvent): Promise<void> {
  await Promise.all([
    saveState(goingName(event.id), [...goingAt(event).entries()]),
    saveState(HELLOS, [...state().hellos]),
  ]);
}

export function resetSocial() {
  delete globalForSocial.__socialState;
}
