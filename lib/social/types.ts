// Going together shapes, client-safe.

export type GoingPerson = {
  id: string;
  name: string;
  year: string;
  major: string;
  shared: string[];
  note?: string;
  instagram?: string;
  /** A hi the viewer sent: pending until they accept, then both see each other's Instagram. */
  hello?: "pending" | "accepted";
  /** Friends the viewer and this person both have, by name (not set for friends). */
  mutual?: string[];
};

export type WhoIsGoing = {
  eventId: string;
  friends: GoingPerson[];
  openToCompany: GoingPerson[];
  othersCount: number;
  /** Everyone going, the viewer included. */
  goingCount: number;
  viewer: { going: boolean; open: boolean; note?: string };
};

/** "3 friends going", or null when no friend is going. */
export function friendsGoingLine(friends: unknown[]): string | null {
  if (friends.length === 0) return null;
  return `${friends.length} ${friends.length === 1 ? "friend" : "friends"} going`;
}

/** "Aaron and Lisa are going", "Aaron, Lisa and 2 other friends are going", or null. */
export function friendsNamesLine(friends: { name: string }[]): string | null {
  if (friends.length === 0) return null;
  if (friends.length === 1) return `${friends[0]!.name} is going`;
  if (friends.length === 2) return `${friends[0]!.name} and ${friends[1]!.name} are going`;
  const rest = friends.length - 2;
  return `${friends[0]!.name}, ${friends[1]!.name} and ${rest} other ${rest === 1 ? "friend" : "friends"} are going`;
}

/** "You both like hackathons and film". */
export function sharedLine(shared: string[]): string {
  if (shared.length <= 1) return `You both like ${shared[0] ?? ""}`.trim();
  return `You both like ${shared.slice(0, -1).join(", ")} and ${shared.at(-1)}`;
}

/** What the viewer shares with this person: first the interests no one else listed shares with them, so two reasons never read the same. */
export function ownReason(person: Pick<GoingPerson, "id" | "shared">, listed: Pick<GoingPerson, "id" | "shared">[]): string {
  const others = new Set(listed.filter((other) => other.id !== person.id).flatMap((other) => other.shared));
  const own = person.shared.filter((interest) => !others.has(interest));
  return sharedLine(own.length > 0 ? own : person.shared);
}

