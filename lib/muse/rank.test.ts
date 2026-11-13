import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentProfile } from "@/lib/events/schema";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { compileCandidates, scheduleClash } from "@/lib/muse/candidates";
import { buildInterestMemory, getInterestMemory, resetInterestMemory } from "@/lib/muse/memory";
import { personalizeEvents, soonestFirst } from "@/lib/muse/rank";
import { isInWindow } from "@/lib/events/time";

// Thursday 10:00 in Austin.
const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);
const student = loadSeedStudent();
const byId = (id: string) => events.find((event) => event.id === id)!;

describe("compileCandidates", () => {
  afterEach(() => resetInterestMemory());

  it("puts what the student watches and follows ahead of what they skip", () => {
    const likely = compileCandidates(student, getInterestMemory(undefined, now), events, now);
    const ids = likely.map((candidate) => candidate.eventId);
    expect(ids.indexOf("evt-climbing-gregory")).toBeLessThan(3);
    expect(ids).not.toContain("evt-yoga-tower");
    // Thursday bouldering runs into Calculus II, so the reason says so.
    expect(likely.find((candidate) => candidate.eventId === "evt-climbing-gregory")?.reason).toBe(
      "You watch rock climbing videos to the end and follow Sample Climbing Club, but it overlaps Calculus II.",
    );
  });

  it("is personal: a different memory changes the list", () => {
    const profile: StudentProfile = { ...student, follows: [], interests: [] };
    const memory = buildInterestMemory(
      "yogi",
      [{ kind: "save", at: now.toISOString(), topics: ["yoga"], creator: "sample_wellness" }],
      now,
    );
    const likely = compileCandidates(profile, memory, events, now);
    expect(likely.map((candidate) => candidate.eventId)).toEqual(["evt-yoga-tower"]);
  });

  it("leaves out a followed club's event on a topic the student keeps skipping", () => {
    const concert = { ...events[0]!, id: "evt-test-concert", title: "Jazz concert", description: "Live music.", food: false, organizer: { name: "Band", handle: "test_band" } };
    const profile: StudentProfile = { ...student, follows: ["test_band"], interests: [] };
    const skipped = buildInterestMemory(
      "skipper",
      [{ kind: "watch", at: now.toISOString(), topics: ["music"], watchSeconds: 2, videoSeconds: 40 }],
      now,
    );
    expect(skipped.avoided).toEqual(["music"]);
    expect(compileCandidates(profile, skipped, [concert], now)).toEqual([]);
    expect(compileCandidates(profile, buildInterestMemory("fresh", [], now), [concert], now)).toHaveLength(1);
  });

  it("skips events that are over", () => {
    const later = new Date(now.getTime() + 3 * 3_600_000);
    const likely = compileCandidates(student, getInterestMemory(undefined, now), events, later);
    expect(likely.map((candidate) => candidate.eventId)).not.toContain("evt-acm-pizza-gdc");
  });
});

describe("scheduleClash", () => {
  it("finds the class an event overlaps in campus time", () => {
    const calculus = { ...byId("evt-film-union"), start: "2026-11-12T20:30:00.000Z", end: "2026-11-12T21:00:00.000Z" };
    expect(scheduleClash(calculus, student.schedule)).toBe("Calculus II");
    expect(scheduleClash(byId("evt-hack-night-eer"), student.schedule)).toBeNull();
  });
});

describe("personalizeEvents without a key", () => {
  beforeEach(() => vi.stubEnv("MUSE_API_KEY", ""));
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInterestMemory();
  });

  it("returns three distinct picks for today and every likely event", async () => {
    const result = await personalizeEvents(student, events, now);
    expect(result.source).toBe("fixture");
    const picks = result.data!.picks;
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((pick) => pick.eventId)).size).toBe(3);
    expect(picks.map((pick) => pick.eventId)).toContain("evt-acm-pizza-gdc");
    expect(picks.map((pick) => pick.eventId)).not.toContain("evt-climbing-gregory");
    expect(result.data!.likely.length).toBeGreaterThan(3);
    expect(result.data!.likely.map((candidate) => candidate.eventId)).toContain("evt-hack-night-eer");
  });

  it("still gives a new user three picks for today", async () => {
    const profile: StudentProfile = { ...student, follows: [], interests: [] };
    const result = await personalizeEvents(profile, events, now, buildInterestMemory("new", [], now));
    expect(result.data!.picks).toHaveLength(3);
    expect(result.data!.likely).toEqual([]);
  });
});

describe("soonestFirst", () => {
  it("puts what is on now first, then day by day with the best match first", () => {
    const likely = compileCandidates(loadSeedStudent(), getInterestMemory(undefined, now), events, now);
    const starts = new Map(events.map((event) => [event.id, Date.parse(event.start)]));
    const day = (at: number) =>
      at <= now.getTime() ? "0" : new Date(at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const sorted = soonestFirst(likely, events, now);
    const keys = sorted.map((candidate) => day(starts.get(candidate.eventId)!));
    expect(keys).toEqual([...keys].sort());
    for (let i = 1; i < sorted.length; i++) {
      if (keys[i] === keys[i - 1]) expect(sorted[i]!.score).toBeLessThanOrEqual(sorted[i - 1]!.score);
    }
    expect(sorted).toHaveLength(likely.length);
  });

  it("ranks a free-food event that matches nothing else below a real match", () => {
    const base = { ...events[0]!, food: true, foodNote: "Pizza", organizer: { name: "Club", handle: "test_club" } };
    const pizza = { ...base, id: "evt-test-pizza", title: "Pizza social", description: "Free pizza." };
    const hack = { ...base, id: "evt-test-hack", title: "Hackathon info session", description: "Free pizza." };
    const profile: StudentProfile = { ...student, follows: [], interests: ["free food", "hackathons"] };
    const [first, second] = compileCandidates(profile, buildInterestMemory("food", [], now), [pizza, hack], now);
    expect(first!.eventId).toBe("evt-test-hack");
    expect(second!.eventId).toBe("evt-test-pizza");
    expect(first!.score - second!.score).toBeGreaterThan(1);
  });
});

describe("top 3", () => {
  beforeEach(() => resetInterestMemory());
  it("only picks events on today", async () => {
    vi.stubEnv("MUSE_API_KEY", "");
    const result = await personalizeEvents(loadSeedStudent(), events, now);
    vi.unstubAllEnvs();
    for (const pick of result.data!.picks) {
      expect(isInWindow(events.find((event) => event.id === pick.eventId)!, "today", now)).toBe(true);
    }
  });
});
