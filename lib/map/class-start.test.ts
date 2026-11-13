import { describe, expect, it } from "vitest";
import { classJustEnded, crawlHeadline } from "@/lib/map/class-start";

const schedule = [
  { label: "Data Structures", weekday: 1, startTime: "11:00", endTime: "12:30" },
  { label: "Calculus II", weekday: 2, startTime: "14:00", endTime: "15:30" },
  { label: "Data Structures", weekday: 3, startTime: "11:00", endTime: "12:30" },
  { label: "Calculus II", weekday: 4, startTime: "14:00", endTime: "15:30" },
];

// Tests run on the frozen test campus (tests/fixtures/brand.ts, America/Chicago, UTC-6 in November).
describe("classJustEnded", () => {
  it("names today's class once it is over (campus time)", () => {
    // Thu Nov 12 2026, 3:45 PM campus time.
    expect(classJustEnded(schedule, new Date("2026-11-12T21:45:00Z"))).toBe("Calculus II");
  });

  it("falls back to the last class on an earlier day", () => {
    // Fri Nov 13 2026, 5 PM campus time: no class Friday, Thursday's was Calculus II.
    expect(classJustEnded(schedule, new Date("2026-11-13T23:00:00Z"))).toBe("Calculus II");
    // Thu at 9 AM campus time, before Calculus ends: Wednesday's Data Structures.
    expect(classJustEnded(schedule, new Date("2026-11-12T15:00:00Z"))).toBe("Data Structures");
  });

  it("is null with no schedule", () => {
    expect(classJustEnded([], new Date())).toBeNull();
  });
});

// Thursday Nov 12 2026 in campus time (Chicago, UTC-6); Calculus II runs 2:00 to 3:30 PM.
describe("crawlHeadline", () => {
  it("leads with the next class today", () => {
    expect(crawlHeadline(schedule, new Date("2026-11-12T18:00:00Z"), 2)).toBe("2 free stops before Calculus II at 2 PM");
  });

  it("reads as just out of class within an hour of it ending", () => {
    expect(crawlHeadline(schedule, new Date("2026-11-12T21:45:00Z"), 1)).toBe("Out of Calculus II: 1 free stop on the way");
  });

  it("is done with class later in the day", () => {
    expect(crawlHeadline(schedule, new Date("2026-11-13T01:00:00Z"), 3)).toBe("Done with class: 3 free stops on the way");
  });

  it("says when there is no class that day", () => {
    // Friday Nov 13, noon campus time.
    expect(crawlHeadline(schedule, new Date("2026-11-13T18:00:00Z"), 1)).toBe("No class today: 1 free stop on the way");
  });

  it("says when nothing is free", () => {
    expect(crawlHeadline(schedule, new Date("2026-11-12T18:00:00Z"), 0)).toBe("Nothing free on the way right now");
  });
});
