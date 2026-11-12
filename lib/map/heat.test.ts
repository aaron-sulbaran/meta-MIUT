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

  it("with interest scores, likely events glow by score and keep their reason", () => {
    const [first, second, third] = events;
    const likely = [
      { eventId: second!.id, score: 2, reason: "Matches rock climbing you watch" },
      { eventId: third!.id, score: 1, reason: "Free today" },
    ];
    const points = heatPoints(events, [{ eventId: first!.id, reason: "Top pick", walkMinutes: 5 }], home, now, likely);
    const byId = new Map(points.map((point) => [point.eventId, point]));
    expect(byId.get(first!.id)).toMatchObject({ pickRank: 1, weight: 1 });
    expect(byId.get(second!.id)).toMatchObject({ weight: 0.6, reason: "Matches rock climbing you watch" });
    expect(byId.get(third!.id)!.weight).toBeCloseTo(0.375);
    const unscored = points.filter((point) => ![first!.id, second!.id, third!.id].includes(point.eventId));
    expect(unscored.every((point) => point.weight === 0.06 && point.reason === null)).toBe(true);
  });
});
