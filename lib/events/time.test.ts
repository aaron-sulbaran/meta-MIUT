import { describe, expect, it } from "vitest";
import { loadSeedEvents } from "@/lib/events/seed";
import { filterEvents } from "@/lib/events/time";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);

describe("filterEvents", () => {
  it("narrows from week to today to now", () => {
    const week = filterEvents(events, { window: "week", freeOnly: false, now });
    const today = filterEvents(events, { window: "today", freeOnly: false, now });
    const happeningNow = filterEvents(events, { window: "now", freeOnly: false, now });
    expect(week.length).toBeGreaterThanOrEqual(today.length);
    expect(today.length).toBeGreaterThanOrEqual(happeningNow.length);
    expect(happeningNow.length).toBeGreaterThan(0);
  });

  it("keeps only free events when the Free toggle is on", () => {
    const free = filterEvents(events, { window: "week", freeOnly: true, now });
    expect(free.every((event) => event.free)).toBe(true);
  });
});
