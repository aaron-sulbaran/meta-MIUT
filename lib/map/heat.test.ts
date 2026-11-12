import { describe, expect, it } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { heatPoints } from "@/lib/map/heat";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);
const home = loadSeedStudent().home;

describe("heatPoints", () => {
  it("puts Muse's picks first and hottest, in pick order", () => {
    const picks = [
      { eventId: events[2]!.id, reason: "Climbing, a club you follow", walkMinutes: 9 },
      { eventId: events[0]!.id, reason: "Free pizza", walkMinutes: 10 },
    ];
    const points = heatPoints(events, picks, home, now);
    expect(points[0]).toMatchObject({ eventId: events[2]!.id, pickRank: 1, weight: 1 });
    expect(points[1]).toMatchObject({ eventId: events[0]!.id, pickRank: 2 });
    const rest = points.slice(2);
    expect(rest.every((point) => point.pickRank === null && point.weight < points[1]!.weight)).toBe(true);
  });

  it("still glows without picks, and drops events that already ended", () => {
    const later = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
    const points = heatPoints(events, [], home, later);
    expect(points.every((point) => point.weight > 0 && point.weight <= 0.6)).toBe(true);
    const ended = events.filter((event) => Date.parse(event.end) <= later.getTime()).map((event) => event.id);
    expect(points.some((point) => ended.includes(point.eventId))).toBe(false);
  });
});
