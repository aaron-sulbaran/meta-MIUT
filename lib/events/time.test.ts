import { describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { filterEvents, formatDateLine, freePerk, isOpenFree } from "@/lib/events/time";

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

  it("says Now until for a live event", () => {
    expect(formatDateLine(at("2026-11-12T15:30:00.000Z", "2026-11-12T17:00:00.000Z"), now)).toBe("Now until 11 AM");
  });

  it("drops :00 and names today and tomorrow in campus time", () => {
    expect(formatDateLine(at("2026-11-12T22:30:00.000Z", "2026-11-12T23:30:00.000Z"), now)).toBe("Today at 4:30 PM");
    expect(formatDateLine(at("2026-11-13T15:00:00.000Z", "2026-11-13T16:00:00.000Z"), now)).toBe("Tomorrow at 9 AM");
  });

  it("uses weekday, month and day further out", () => {
    expect(formatDateLine(at("2026-11-15T00:00:00.000Z", "2026-11-15T02:00:00.000Z"), now)).toBe("Sat, Nov 14 at 6 PM");
  });
});

describe("freePerk", () => {
  const base = events[0];
  const make = (over: Partial<CampusEvent>): CampusEvent => ({ ...base, title: "Night", description: "Come by.", ...over }) as CampusEvent;

  it("says what a free event gives: the food, then any merch", () => {
    expect(freePerk(make({ free: true, food: true, foodNote: "Popcorn and soda" }))).toBe("Popcorn and soda");
    expect(freePerk(make({ free: true, food: true, foodNote: "Pizza", description: "Free swag too." }))).toBe("Pizza, swag");
    expect(freePerk(make({ free: true, food: false, foodNote: undefined, description: "T-shirts and stickers." }))).toBe(
      "T-shirts, stickers",
    );
    expect(freePerk(make({ free: true, food: true, foodNote: undefined }))).toBe("Food");
  });

  it("is null for a free talk with nothing to take away, or a paid event", () => {
    expect(freePerk(make({ free: true, food: false, foodNote: undefined }))).toBeNull();
    expect(freePerk(make({ free: false, food: true, foodNote: "Dinner" }))).toBeNull();
  });
});

describe("isOpenFree", () => {
  const base = events[0];
  const make = (over: Partial<CampusEvent>): CampusEvent =>
    ({ ...base, title: "Night", free: true, food: true, foodNote: "Boba", access: { kind: "open" }, ...over }) as CampusEvent;

  it("leaves out events free for only some students", () => {
    expect(isOpenFree(make({ description: "Free for MIT, $7 for non-MIT students." }))).toBe(false);
    expect(freePerk(make({ description: "Free for the MIT community, $20 general." }))).toBeNull();
  });

  it("keeps events free for everyone, a suggested donation included", () => {
    expect(isOpenFree(make({ description: "Come by." }))).toBe(true);
    expect(isOpenFree(make({ description: "Free, suggested donation $15." }))).toBe(true);
  });
});
