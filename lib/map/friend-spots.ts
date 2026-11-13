import { EVERYONE, personNamedIn } from "@/lib/social/fixtures/people";

// Where the demo student's friends are right now, for the map's "meet a
// friend" re-plan ("I'm meeting Lisa, find one closer to both of us"). Friends
// share their location by opting in; the demo seeds it on the people fixture
// (lib/social/fixtures/people.ts, the one place friends live). Client safe:
// the map reads it in the browser.

export type FriendSpot = {
  id: string;
  name: string;
  placeName: string;
  lat: number;
  lng: number;
};

export const FRIEND_SPOTS: FriendSpot[] = EVERYONE.flatMap((person) =>
  person.spot ? [{ id: person.id, name: person.name, ...person.spot }] : [],
);

/** The first friend named in what the student said or typed, or null. Whole words only. */
export function friendNamedIn(text: string): FriendSpot | null {
  return personNamedIn(text, FRIEND_SPOTS);
}

/**
 * One line for Muse when the student names a friend who shares their location,
 * so "find one closer to both of us" can be planned without asking where they are.
 */
export function friendContext(text: string): string | null {
  const friend = friendNamedIn(text);
  return friend
    ? `(${friend.name} is a friend sharing their location: ${friend.placeName}. Plan the walk to ${friend.name} now with plan_night: pick the best free stop between them yourself and do not ask a follow-up.)`
    : null;
}

/** How the walk's end reads on the plan sheet and to Muse's planner. */
export function friendLabel(friend: FriendSpot): string {
  return `${friend.name} at ${friend.placeName}`;
}
