import { describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { nearestFreeBite } from "@/lib/demo/free-bite";

const NOW = new Date("2026-11-13T21:00:00Z");
const HERE = { lat: 42.3616, lng: -71.0906 };

function event(id: string, overrides: Partial<CampusEvent>): CampusEvent {
  return {
    id,
    title: id,
    description: "Free snacks for everyone",
    start: "2026-11-13T20:30:00Z",
    end: "2026-11-13T23:00:00Z",
    place: { name: id, lat: 42.3617, lng: -71.0905 },
    free: true,
    food: true,
    foodNote: "Pizza",
    access: { kind: "open" },
    organizer: { name: "Club", handle: "club" },
    source: { kind: "manual" },
    status: "published",
    createdAt: "2026-11-13T00:00:00Z",
    ...overrides,
  } as CampusEvent;
}

describe("nearestFreeBite", () => {
  it("picks the closest free food that is on now", () => {
    const far = event("far", { place: { name: "far", lat: 42.37, lng: -71.1 } });
    const near = event("near", {});
    expect(nearestFreeBite([far, near], HERE, NOW)?.eventId).toBe("near");
  });

  it("skips food that ends within 15 minutes, starts later than 20, costs money, or needs a seat", () => {
    const ending = event("ending", { end: "2026-11-13T21:10:00Z" });
    const later = event("later", { start: "2026-11-13T21:45:00Z" });
    const paid = event("paid", { free: false });
    const seats = event("seats", { access: { kind: "rsvp", capacity: 30 } });
    expect(nearestFreeBite([ending, later, paid, seats], HERE, NOW)).toBeNull();
  });
});
