import { describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { filterEvents, formatDateLine } from "@/lib/events/time";

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

describe("formatDateLine", () => {
  const base = events[0];
  if (!base) throw new Error("seed has no events");
  const at = (startIso: string, endIso: string): CampusEvent => ({ ...base, start: startIso, end: endIso });

  it("says Happening now for a live event", () => {
    expect(formatDateLine(at("2026-11-12T15:30:00.000Z", "2026-11-12T17:00:00.000Z"), now)).toBe(
      "Happening now, until 11 AM",
    );
  });

  it("drops :00 and names today and tomorrow in campus time", () => {
    expect(formatDateLine(at("2026-11-12T22:30:00.000Z", "2026-11-12T23:30:00.000Z"), now)).toBe("Today at 4:30 PM");
    expect(formatDateLine(at("2026-11-13T15:00:00.000Z", "2026-11-13T16:00:00.000Z"), now)).toBe("Tomorrow at 9 AM");
  });

  it("uses weekday, month and day further out", () => {
    expect(formatDateLine(at("2026-11-15T00:00:00.000Z", "2026-11-15T02:00:00.000Z"), now)).toBe("Sat, Nov 14 at 6 PM");
  });
});
