import { describe, expect, it } from "vitest";
import { nearbyAlertFor } from "@/lib/alerts/policy";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { DEMO_USER_ID, getInterestMemory } from "@/lib/muse/memory";

// Thursday 4:00 PM in Austin, just after Calculus II ends.
const NOW = new Date("2026-11-12T22:00:00.000Z");
const GDC = { lat: 30.2862, lng: -97.7366 };
const events = loadSeedEvents(NOW);
const byId = (id: string) => events.find((event) => event.id === id) as CampusEvent;
const viewer = { profile: loadSeedStudent(), memory: getInterestMemory(DEMO_USER_ID, NOW), location: GDC, now: NOW };

describe("nearbyAlertFor", () => {
  it("alerts free food that is on now and steps away", () => {
    const match = nearbyAlertFor(byId("evt-acm-pizza-gdc"), viewer);
    expect(match?.kind).toBe("free_food_nearby");
    expect(match?.meters).toBeLessThan(60);
  });

  it("alerts an event starting within the hour", () => {
    expect(nearbyAlertFor(byId("evt-tacos-south-mall"), viewer)).not.toBeNull();
  });

  it("waits on events more than an hour out", () => {
    expect(nearbyAlertFor(byId("evt-climbing-gregory"), viewer)).toBeNull();
  });

  it("stays quiet past a mile, after the end, and for drafts", () => {
    const far = { ...viewer, location: { lat: 30.31, lng: -97.7 } };
    expect(nearbyAlertFor(byId("evt-acm-pizza-gdc"), far)).toBeNull();
    const later = { ...viewer, now: new Date(NOW.getTime() + 3 * 60 * 60_000) };
    expect(nearbyAlertFor(byId("evt-acm-pizza-gdc"), later)).toBeNull();
    expect(nearbyAlertFor({ ...byId("evt-acm-pizza-gdc"), status: "draft" }, viewer)).toBeNull();
  });

  it("skips events the student keeps scrolling past", () => {
    const yoga = { ...byId("evt-yoga-tower"), start: NOW.toISOString(), end: new Date(NOW.getTime() + 3_600_000).toISOString() };
    expect(nearbyAlertFor(yoga, viewer)).toBeNull();
  });

  it("does not pull the student out of class", () => {
    // Thursday 2:15 PM, during Calculus II.
    const inClass = new Date("2026-11-12T20:15:00.000Z");
    const pizza = { ...byId("evt-acm-pizza-gdc"), start: inClass.toISOString(), end: new Date(inClass.getTime() + 3_600_000).toISOString() };
    expect(nearbyAlertFor(pizza, { ...viewer, now: inClass })).toBeNull();
  });
});
