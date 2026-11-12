import { describe, expect, it } from "vitest";
import { EventSchema, StudentProfileSchema } from "@/lib/events/schema";
import eventsFile from "../data/seed/events.json";
import studentFile from "../data/seed/student.json";

// The app's own seed, read by relative path because tests alias the seed to tests/fixtures.
describe("demo seed", () => {
  const now = Date.parse("2026-11-12T23:55:00.000Z");
  const events = eventsFile.events.map(({ startsInMinutes, durationMinutes, ...rest }) => {
    const start = now + startsInMinutes * 60_000;
    return EventSchema.parse({
      ...rest,
      start: new Date(start).toISOString(),
      end: new Date(start + durationMinutes * 60_000).toISOString(),
      status: "published",
      createdAt: new Date(now).toISOString(),
    });
  });

  it("every event meets the contract, ids are unique, and there are free and paid events", () => {
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(events.some((event) => event.free)).toBe(true);
    expect(events.some((event) => !event.free)).toBe(true);
  });

  it("the student parses", () => {
    expect(StudentProfileSchema.safeParse(studentFile.profile).success).toBe(true);
  });
});
