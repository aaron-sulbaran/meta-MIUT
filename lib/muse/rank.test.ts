import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentProfile } from "@/lib/events/schema";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { compileCandidates, scheduleClash } from "@/lib/muse/candidates";
import { buildInterestMemory, getInterestMemory, resetInterestMemory } from "@/lib/muse/memory";
import { forYouOrder, personalizeEvents, soonestFirst } from "@/lib/muse/rank";
import { isInWindow } from "@/lib/events/time";

// Thursday 10:00 in Austin.
const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);
const student = loadSeedStudent();
const byId = (id: string) => events.find((event) => event.id === id)!;

describe("For you list", () => {
  it("reaches past this week when asked", () => {
    const climbing = byId("evt-climbing-gregory");
    const day = 24 * 60 * 60 * 1000;
    const far = {
      ...climbing,
      id: "evt-far",
      start: new Date(now.getTime() + 10 * day).toISOString(),
      end: new Date(now.getTime() + 10 * day + 2 * 60 * 60 * 1000).toISOString(),
    };
    const memory = getInterestMemory(undefined, now);
    expect(compileCandidates(student, memory, [far], now)).toEqual([]);
    expect(compileCandidates(student, memory, [far], now, "upcoming")).toHaveLength(1);
  });

  it("keeps every upcoming event, the likely ones first, minus the skipped ones", () => {
    const likely = compileCandidates(student, getInterestMemory(undefined, now), events, now, "upcoming");
    const skip = new Set([likely[0]!.eventId]);
    const list = forYouOrder(likely, events, now, skip);
    const upcoming = events.filter((event) => event.status === "published" && Date.parse(event.end) > now.getTime());
    expect(list).toHaveLength(upcoming.length - 1);
    expect(list.map((event) => event.id)).not.toContain(likely[0]!.eventId);
    expect(list[0]!.id).toBe(likely[1]!.eventId);
    expect(list.map((event) => event.id)).toContain("evt-yoga-tower");
  });
});

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
  it("puts what is on now first, then the soonest to start", () => {
    const likely = compileCandidates(loadSeedStudent(), getInterestMemory(undefined, now), events, now);
    const starts = new Map(events.map((event) => [event.id, Date.parse(event.start)]));
    const keys = soonestFirst(likely, events, now).map((candidate) => {
      const start = starts.get(candidate.eventId)!;
      return start <= now.getTime() ? -Infinity : start;
    });
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(soonestFirst(likely, events, now)).toHaveLength(likely.length);
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
