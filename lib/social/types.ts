// Going together shapes, client-safe.

export type GoingPerson = {
  id: string;
  name: string;
  year: string;
  major: string;
  shared: string[];
  note?: string;
  instagram?: string;
  hello?: "accepted";
};

export type WhoIsGoing = {
  eventId: string;
  friends: GoingPerson[];
  openToCompany: GoingPerson[];
  othersCount: number;
  viewer: { going: boolean; open: boolean; note?: string };
};

/** "3 friends going", or null when no friend is going. */
export function friendsGoingLine(friends: unknown[]): string | null {
  if (friends.length === 0) return null;
  return `${friends.length} ${friends.length === 1 ? "friend" : "friends"} going`;
}

/** "You both like hackathons and film". */
export function sharedLine(shared: string[]): string {
  if (shared.length <= 1) return `You both like ${shared[0] ?? ""}`.trim();
  return `You both like ${shared.slice(0, -1).join(", ")} and ${shared.at(-1)}`;
}
