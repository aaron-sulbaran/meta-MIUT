import { describe, expect, it } from "vitest";
import { classJustEnded } from "@/lib/map/class-start";

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
