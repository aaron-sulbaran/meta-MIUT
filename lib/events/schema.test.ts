import { describe, expect, it } from "vitest";
import { parseEvent, parseStudentProfile } from "@/lib/events/schema";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";

const goodEvent = {
  id: "evt-test",
  title: "Test event",
  description: "A test.",
  start: "2026-11-12T18:00:00.000Z",
  end: "2026-11-12T20:00:00.000Z",
  place: { name: "Gregory Gym", lat: 30.2843, lng: -97.7366 },
  free: true,
  food: false,
  access: { kind: "rsvp", capacity: 30 },
  organizer: { name: "Test Club", handle: "test_club" },
  source: { kind: "manual" },
  status: "published",
  confidence: { title: 0.9, start: 0.5 },
  createdAt: "2026-11-10T12:00:00.000Z",
};

describe("event contract", () => {
  it("parses a good event", () => {
    const result = parseEvent(goodEvent);
    expect(result.error).toBeNull();
    expect(result.data?.access.capacity).toBe(30);
  });

  it("rejects a bad event with a readable error", () => {
    const result = parseEvent({ ...goodEvent, start: "tomorrow", access: { kind: "maybe" } });
    expect(result.data).toBeNull();
    expect(result.error).toContain("start");
    expect(result.error).toContain("access");
  });

  it("rejects an event that ends before it starts", () => {
    const result = parseEvent({ ...goodEvent, end: "2026-11-12T17:00:00.000Z" });
    expect(result.error).toContain("end must be after start");
  });

  it("rejects a confidence outside 0 to 1", () => {
    expect(parseEvent({ ...goodEvent, confidence: { title: 1.5 } }).data).toBeNull();
  });
});

describe("seed data", () => {
  it("loads every seed event against the contract, relative to now", () => {
    const now = new Date("2026-11-12T16:00:00.000Z");
    const events = loadSeedEvents(now);
    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(events.some((event) => Date.parse(event.start) <= now.getTime() && Date.parse(event.end) > now.getTime())).toBe(true);
  });

  it("loads the seed student", () => {
    expect(parseStudentProfile(loadSeedStudent()).error).toBeNull();
  });
});
