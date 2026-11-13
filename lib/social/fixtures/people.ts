// PLACEHOLDER: invented students and a friends list for the demo. There are
// no accounts yet; the demo viewer is the sample student.

export type Person = {
  id: string;
  name: string;
  year: string;
  major: string;
  interests: string[];
  instagram: string;
};

export const PEOPLE: Person[] = [
  { id: "maya", name: "Maya", year: "Second-year", major: "Computer Science", interests: ["coding", "hackathons", "free food"], instagram: "sample_maya" },
  { id: "leo", name: "Leo", year: "Third-year", major: "Film", interests: ["film", "music", "free food"], instagram: "sample_leo" },
  { id: "priya", name: "Priya", year: "Second-year", major: "Biology", interests: ["rock climbing", "yoga", "wellness"], instagram: "sample_priya" },
  { id: "sam", name: "Sam", year: "Fourth-year", major: "Economics", interests: ["careers", "coding", "free food"], instagram: "sample_sam" },
  { id: "ava", name: "Ava", year: "First-year", major: "Undeclared", interests: ["rock climbing", "film", "hackathons"], instagram: "sample_ava" },
  { id: "noah", name: "Noah", year: "Third-year", major: "Electrical Engineering", interests: ["hackathons", "coding", "music"], instagram: "sample_noah" },
  { id: "zoe", name: "Zoe", year: "Second-year", major: "Kinesiology", interests: ["yoga", "wellness", "rock climbing"], instagram: "sample_zoe" },
  { id: "kai", name: "Kai", year: "First-year", major: "Music", interests: ["music", "film", "free food"], instagram: "sample_kai" },
  { id: "lena", name: "Lena", year: "Fourth-year", major: "Business", interests: ["careers", "free food", "wellness"], instagram: "sample_lena" },
];

export const FRIENDS: Record<string, string[]> = {
  "sample-student": ["maya", "leo", "priya", "sam"],
};

// What fixture students going alone say about it.
export const OPEN_NOTES = [
  "Going solo, would love company",
  "First time going, anyone want to walk over together?",
  "Looking for people to go with",
];
