// PLACEHOLDER: invented students and a friends list for the demo. There are
// no accounts yet. The demo viewer is the sample student, who plays Jolyn
// (User 1 in the demo script); the `demo-persona` cookie switches a phone to
// Lisa or Trish (User 3) (lib/social/viewer.ts).

export type Person = {
  id: string;
  name: string;
  year: string;
  major: string;
  interests: string[];
  instagram: string;
  /** Where they are right now, when they share their location with friends (opt in; seeded for the demo). */
  spot?: { placeName: string; lat: number; lng: number };
};

export const PEOPLE: Person[] = [
  { id: "maya", name: "Maya", year: "Second-year", major: "Computer Science", interests: ["coding", "hackathons", "free food"], instagram: "sample_maya", spot: { placeName: "Simmons Hall", lat: 42.357, lng: -71.1012 } },
  { id: "leo", name: "Leo", year: "Third-year", major: "Film", interests: ["film", "music", "free food"], instagram: "sample_leo", spot: { placeName: "Central Square", lat: 42.3654, lng: -71.1037 } },
  { id: "priya", name: "Priya", year: "Second-year", major: "Biology", interests: ["rock climbing", "yoga", "wellness"], instagram: "sample_priya" },
  { id: "sam", name: "Sam", year: "Fourth-year", major: "Economics", interests: ["careers", "coding", "free food"], instagram: "sample_sam" },
  { id: "ava", name: "Ava", year: "First-year", major: "Undeclared", interests: ["rock climbing", "film", "hackathons"], instagram: "sample_ava" },
  { id: "noah", name: "Noah", year: "Third-year", major: "Electrical Engineering", interests: ["hackathons", "coding", "music"], instagram: "sample_noah" },
  { id: "zoe", name: "Zoe", year: "Second-year", major: "Kinesiology", interests: ["yoga", "wellness", "rock climbing"], instagram: "sample_zoe" },
  { id: "kai", name: "Kai", year: "First-year", major: "Music", interests: ["music", "film", "free food"], instagram: "sample_kai" },
  { id: "lena", name: "Lena", year: "Fourth-year", major: "Business", interests: ["careers", "free food", "wellness"], instagram: "sample_lena" },
  { id: "omar", name: "Omar", year: "Third-year", major: "Mechanical Engineering", interests: ["rock climbing", "hackathons", "free food"], instagram: "sample_omar" },
  { id: "jade", name: "Jade", year: "Second-year", major: "Comparative Media Studies", interests: ["film", "music", "studying"], instagram: "sample_jade" },
  { id: "eli", name: "Eli", year: "First-year", major: "Physics", interests: ["studying", "coding", "free food"], instagram: "sample_eli" },
  { id: "rosa", name: "Rosa", year: "Graduate", major: "Urban Planning", interests: ["careers", "fitness", "film"], instagram: "sample_rosa" },
  { id: "theo", name: "Theo", year: "Second-year", major: "Mathematics", interests: ["hackathons", "film", "rock climbing"], instagram: "sample_theo" },
  { id: "nina", name: "Nina", year: "Third-year", major: "Brain and Cognitive Sciences", interests: ["wellness", "music", "free food"], instagram: "sample_nina" },
  { id: "mina", name: "Mina", year: "Second-year", major: "Architecture", interests: ["film", "free food", "studying"], instagram: "sample_mina" },
  { id: "jonah", name: "Jonah", year: "Third-year", major: "Computer Science", interests: ["hackathons", "coding", "rock climbing"], instagram: "sample_jonah" },
  { id: "iris", name: "Iris", year: "First-year", major: "Chemistry", interests: ["free food", "wellness", "film"], instagram: "sample_iris" },
  { id: "diego", name: "Diego", year: "Fourth-year", major: "Aerospace Engineering", interests: ["hackathons", "careers", "free food"], instagram: "sample_diego" },
  { id: "hana", name: "Hana", year: "Second-year", major: "Linguistics", interests: ["film", "music", "free food"], instagram: "sample_hana" },
  { id: "ravi", name: "Ravi", year: "Graduate", major: "Operations Research", interests: ["coding", "careers", "rock climbing"], instagram: "sample_ravi" },
];

// The demo's people. They are never seeded as going: they show up only once
// they mark going themselves (Jolyn from the map or Ask Muse, Lisa from the
// invite), so Trish (User 3) sees them appear.
export const PERSONAS: Person[] = [
  { id: "sample-student", name: "Jolyn", year: "Second-year", major: "Computer Science", interests: ["rock climbing", "free food", "hackathons", "film"], instagram: "sample_jolyn" },
  { id: "lisa", name: "Lisa", year: "Second-year", major: "Comparative Media Studies", interests: ["film", "free food", "music"], instagram: "sample_lisa", spot: { placeName: "Kendall Square", lat: 42.3626, lng: -71.0843 } },
  { id: "user3", name: "Trish", year: "First-year", major: "Undeclared", interests: ["free food", "film", "hackathons"], instagram: "sample_trish" },
];

export const PERSONA_IDS = new Set(PERSONAS.map((person) => person.id));

/** Everyone the going lists can name: the invented students and the demo's people. */
export const EVERYONE: Person[] = [...PEOPLE, ...PERSONAS];

export const FRIENDS: Record<string, string[]> = {
  "sample-student": ["maya", "leo", "priya", "sam", "lisa", "mina", "jonah", "iris", "diego", "hana", "ravi"],
  lisa: ["sample-student", "leo", "jade"],
  user3: ["sample-student", "lisa", "ava"],
};

/** The first of these people named in what a student said or typed, whole words only, or null. The one person lookup. */
export function personNamedIn<P extends { name: string }>(text: string, people: P[]): P | null {
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  return people.find((person) => words.has(person.name.toLowerCase())) ?? null;
}

/** Friends both people have, by name: "mutual friends" for someone who is not a friend yet. */
export function mutualFriends(viewerId: string, personId: string): string[] {
  const mine = new Set(FRIENDS[viewerId] ?? []);
  const theirs = new Set([...(FRIENDS[personId] ?? []), ...Object.entries(FRIENDS).filter(([, list]) => list.includes(personId)).map(([id]) => id)]);
  return EVERYONE.filter((person) => mine.has(person.id) && theirs.has(person.id) && person.id !== personId).map((person) => person.name);
}

// What fixture students going alone say about it.
export const OPEN_NOTES = [
  "Going solo, would love company",
  "First time going, anyone want to walk over together?",
  "Looking for people to go with",
];
