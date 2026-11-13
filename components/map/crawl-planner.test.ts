import { describe, expect, it } from "vitest";
import { campusTodayAt } from "@/components/map/crawl-planner";

// Tests use the fixture campus (tests/fixtures/brand.ts), on Chicago time.
describe("campusTodayAt", () => {
  it("is the picked time on the campus day of the base", () => {
    const base = Date.parse("2026-11-13T15:00:00Z"); // 9:00 AM CST
    expect(new Date(campusTodayAt("18:30", base)).toISOString()).toBe("2026-11-14T00:30:00.000Z");
  });

  it("stays on the campus day late in the evening, when UTC is already tomorrow", () => {
    const base = Date.parse("2026-11-14T04:30:00Z"); // 10:30 PM on the 13th, campus time
    expect(new Date(campusTodayAt("23:00", base)).toISOString()).toBe("2026-11-14T05:00:00.000Z");
  });

  it("follows daylight time in summer", () => {
    const base = Date.parse("2026-07-01T17:00:00Z"); // noon CDT
    expect(new Date(campusTodayAt("18:00", base)).toISOString()).toBe("2026-07-01T23:00:00.000Z");
  });
});
