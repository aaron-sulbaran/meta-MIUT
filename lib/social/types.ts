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

/** "Maya, Leo + 2 friends going", or null when no friend is going. */
export function friendsGoingLine(friends: { name: string }[]): string | null {
  if (friends.length === 0) return null;
  const names = friends.slice(0, 2).map((friend) => friend.name).join(", ");
  const rest = friends.length - 2;
  if (rest > 0) return `${names} + ${rest} ${rest === 1 ? "friend" : "friends"} going`;
  return `${names} ${friends.length === 1 ? "is" : "are"} going`;
}
