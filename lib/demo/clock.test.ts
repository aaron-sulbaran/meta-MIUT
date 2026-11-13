import { describe, expect, it } from "vitest";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { demoClock } from "@/lib/demo/clock";

const campusTime = (date: Date) =>
  date.toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit" });

describe("demoClock", () => {
  it("is 3:05 PM the same campus day in the morning", () => {
    expect(campusTime(demoClock(new Date("2026-11-13T09:00:00-05:00")))).toBe("Fri 3:05 PM");
  });
  it("stays on today while the afternoon is under way", () => {
    expect(campusTime(demoClock(new Date("2026-11-12T16:00:00-05:00")))).toBe("Thu 3:05 PM");
  });
  it("moves to tomorrow late at night", () => {
    expect(campusTime(demoClock(new Date("2026-11-12T23:50:00-05:00")))).toBe("Fri 3:05 PM");
    expect(campusTime(demoClock(new Date("2026-11-13T01:47:00-05:00")))).toBe("Fri 3:05 PM");
  });
  it("holds across daylight saving time", () => {
    expect(campusTime(demoClock(new Date("2026-07-01T08:00:00-04:00")))).toBe("Wed 3:05 PM");
  });
});
