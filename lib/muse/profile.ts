import { z } from "zod";
import { StudentProfileSchema, type StudentProfile } from "@/lib/events/schema";

// The student profile from the event contract plus what Muse personalizes
// with. Every extra field is optional and comes from the student. Muse never
// collects or infers race, ethnicity, religion, or other protected traits; a
// cultural or affinity community counts only when the student lists it.

export const CLASS_YEARS = ["first-year", "second-year", "third-year", "fourth-year", "graduate"] as const;

const label = z.string().trim().min(1).max(80);

export const StudentContextSchema = StudentProfileSchema.extend({
  age: z.number().int().min(16).max(99).optional(),
  year: z.enum(CLASS_YEARS).optional(),
  major: label.optional(),
  minor: label.optional(),
  languages: z.array(label).max(10).optional(),
  communities: z.array(label).max(20).optional(),
  dietary: z.array(label).max(10).optional(),
  // Live location; walking times use it instead of home when present.
  location: StudentProfileSchema.shape.home.optional(),
});

export type StudentContext = z.infer<typeof StudentContextSchema>;

// Topics a major or minor suggests, matched by substring of the field name.
export const MAJOR_TOPICS: Record<string, string[]> = {
  "computer science": ["coding", "hackathons"],
  computer: ["coding"],
  software: ["coding", "hackathons"],
  data: ["coding"],
  engineering: ["hackathons"],
  business: ["careers"],
  finance: ["careers"],
  economics: ["careers"],
  accounting: ["careers"],
  film: ["film"],
  "radio-television-film": ["film"],
  music: ["music"],
  kinesiology: ["fitness", "wellness"],
  nutrition: ["wellness"],
  psychology: ["wellness"],
};

export function studyTopics(profile: Pick<StudentContext, "major" | "minor" | "year">): string[] {
  const fields = [profile.major, profile.minor].filter(Boolean).join(" ").toLowerCase();
  const topics = new Set(
    Object.entries(MAJOR_TOPICS)
      .filter(([field]) => fields.includes(field))
      .flatMap(([, list]) => list),
  );
  if (profile.year && profile.year !== "first-year" && profile.year !== "second-year") topics.add("careers");
  return [...topics];
}

/** Where walking times start: the live location when known, else home. */
export function origin(profile: StudentContext): StudentProfile["home"] {
  return profile.location ?? profile.home;
}

/** The minimum age an event's text states, like "21+" or "18 and over", or null. */
export function minimumAge(text: string): number | null {
  const match = /\b(18|21)\s*(?:\+|and over|and up|or older)/i.exec(text);
  return match ? Number(match[1]) : null;
}
