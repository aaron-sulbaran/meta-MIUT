import { describe, expect, it } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { compileCandidates } from "@/lib/muse/candidates";
import { buildInterestMemory } from "@/lib/muse/memory";
import { minimumAge, StudentContextSchema, studyTopics, type StudentContext } from "@/lib/muse/profile";

// Thursday 10:00 in Austin.
const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);
const blank: StudentContext = { ...loadSeedStudent(), follows: [], interests: [] };
const empty = buildInterestMemory("new", [], now);
const ids = (profile: StudentContext, list = events) =>
  compileCandidates(profile, empty, list, now).map((candidate) => candidate.eventId);

describe("student context", () => {
  it("uses the major: computer science brings in coding and hack nights", () => {
    expect(ids(blank)).toEqual([]);
    const cs = ids({ ...blank, major: "Computer Science" });
    expect(cs).toContain("evt-acm-pizza-gdc");
    expect(cs).toContain("evt-hack-night-eer");
  });

  it("uses the class year: upper years get career events", () => {
    expect(studyTopics({ year: "first-year" })).not.toContain("careers");
    expect(ids({ ...blank, year: "third-year" })).toContain("evt-career-sac");
  });

  it("counts a community only when the student lists it", () => {
    expect(ids(blank)).not.toContain("evt-tacos-south-mall");
    expect(ids({ ...blank, communities: ["Student Government"] })).toContain("evt-tacos-south-mall");
  });

  it("gives a small lift when the food fits their diet", () => {
    const cs = { ...blank, major: "Computer Science" };
    const score = (profile: StudentContext) =>
      compileCandidates(profile, empty, events, now).find((candidate) => candidate.eventId === "evt-acm-pizza-gdc")!.score;
    expect(score({ ...cs, dietary: ["vegetarian"] })).toBeGreaterThan(score(cs));
  });

  it("leaves out events the student is too young for", () => {
    const film = events.find((event) => event.id === "evt-film-union")!;
    const late = [{ ...film, title: "Late film night, 21+" }];
    const fan = { ...blank, interests: ["film"] };
    expect(minimumAge("Trivia, 18 and over")).toBe(18);
    expect(ids({ ...fan, age: 20 }, late)).toEqual([]);
    expect(ids({ ...fan, age: 22 }, late)).toEqual(["evt-film-union"]);
    expect(ids(fan, late)).toEqual(["evt-film-union"]);
  });

  it("measures walks from the live location when it is known", () => {
    const cs = { ...blank, major: "Computer Science" };
    const walk = (profile: StudentContext) =>
      compileCandidates(profile, empty, events, now).find((candidate) => candidate.eventId === "evt-acm-pizza-gdc")!
        .walkMinutes;
    expect(walk({ ...cs, location: { lat: 30.2862, lng: -97.7366 } })).toBeLessThan(walk(cs));
  });

  it("drops fields Muse must not use, like ethnicity", () => {
    const parsed = StudentContextSchema.parse({ ...blank, ethnicity: "anything", major: "Biology" });
    expect(parsed).not.toHaveProperty("ethnicity");
    expect(parsed.major).toBe("Biology");
  });
});
