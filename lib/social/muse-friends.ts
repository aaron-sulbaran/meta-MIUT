import "server-only";
import type { CampusEvent } from "@/lib/events/schema";
import { EVERYONE, FRIENDS, mutualFriends } from "@/lib/social/fixtures/people";
import { loadSocial, whoIsGoing } from "@/lib/social/going";
import type { Viewer } from "@/lib/social/viewer";

// What Ask Muse knows about the student's people: their friends and where
// those friends are going, and, for meeting new people, students who share
// their interests (with the events where they are open to company).

export type FriendNote = { name: string; year: string; major: string; sharedInterests: string[]; goingTo: string[] };
export type PersonSuggestion = FriendNote & { mutualFriends: string[]; openToCompanyAt: string[] };
export type SocialContext = { friends: FriendNote[]; suggestions: PersonSuggestion[] };

const SUGGESTIONS = 5;

export async function socialContext(viewer: Viewer, events: CampusEvent[], now = new Date()): Promise<SocialContext> {
  const upcoming = events.filter((event) => event.status === "published" && Date.parse(event.end) > now.getTime());
  await loadSocial(upcoming.map((event) => event.id));
  const mine = new Set(viewer.interests.map((interest) => interest.toLowerCase()));
  const friendIds = new Set(FRIENDS[viewer.id] ?? []);
  const goingTo = new Map<string, string[]>();
  const openAt = new Map<string, string[]>();
  for (const event of upcoming) {
    const who = whoIsGoing(event, viewer.id, viewer.interests);
    for (const friend of who.friends) goingTo.set(friend.id, [...(goingTo.get(friend.id) ?? []), event.title]);
    for (const person of who.openToCompany) openAt.set(person.id, [...(openAt.get(person.id) ?? []), event.title]);
  }
  const note = (person: (typeof EVERYONE)[number]): FriendNote => ({
    name: person.name,
    year: person.year,
    major: person.major,
    sharedInterests: person.interests.filter((interest) => mine.has(interest)),
    goingTo: goingTo.get(person.id) ?? [],
  });
  const friends = EVERYONE.filter((person) => friendIds.has(person.id)).map(note);
  const suggestions = EVERYONE.filter((person) => person.id !== viewer.id && !friendIds.has(person.id))
    .map((person) => ({ ...note(person), mutualFriends: mutualFriends(viewer.id, person.id), openToCompanyAt: openAt.get(person.id) ?? [] }))
    .filter((person) => person.sharedInterests.length > 0)
    .sort(
      (a, b) =>
        b.openToCompanyAt.length - a.openToCompanyAt.length ||
        b.sharedInterests.length - a.sharedInterests.length ||
        b.mutualFriends.length - a.mutualFriends.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, SUGGESTIONS);
  return { friends, suggestions };
}
