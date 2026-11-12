import { describe, expect, it } from "vitest";
import { eventsForChip } from "@/components/events/chip-filter";
import { loadSeedEvents } from "@/lib/events/seed";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);

describe("eventsForChip", () => {
  it("Free keeps only free events and includes later in the week", () => {
    const free = eventsForChip(events, "free", now);
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((event) => event.free)).toBe(true);
    expect(free.length).toBeGreaterThanOrEqual(eventsForChip(events, "forYou", now).length);
  });

  it("Today shows paid events too, but nothing past today", () => {
    const today = eventsForChip(events, "today", now);
    expect(today.some((event) => !event.free)).toBe(true);
    expect(today.length).toBeLessThan(eventsForChip(events, "week", now).length);
  });

  it("This week is the widest list and is sorted by start", () => {
    const week = eventsForChip(events, "week", now);
    const starts = week.map((event) => Date.parse(event.start));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(week.length).toBeGreaterThanOrEqual(eventsForChip(events, "free", now).length);
  });

  it("For you lists free events happening today", () => {
    const forYou = eventsForChip(events, "forYou", now);
    expect(forYou.length).toBeGreaterThan(0);
    expect(forYou.every((event) => event.free)).toBe(true);
  });
});
