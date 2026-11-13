import { describe, expect, it } from "vitest";
import { createMemoryAlertFeed } from "@/lib/alerts/feed";
import { openToPublic } from "@/lib/events/open";
import type { CampusEvent } from "@/lib/events/schema";
import { createMemoryStore } from "@/lib/events/store";
import { filterEvents, isOpenFree } from "@/lib/events/time";

const NOW = new Date("2026-11-12T20:00:00.000Z");

const limited: CampusEvent = {
  id: "evt-boulder-limited",
  title: "Fall Boulder Social",
  description: "All levels welcome.",
  start: "2026-11-12T19:00:00.000Z",
  end: "2026-11-12T20:30:00.000Z",
  place: { name: "Climbing wall", lat: 30.2843, lng: -97.7365 },
  free: true,
  food: true,
  foodNote: "pizza",
  access: { kind: "rsvp", capacity: 40 },
  organizer: { name: "Sample Climbing Club", handle: "sample_climbing" },
  source: { kind: "manual" },
  status: "published",
  createdAt: "2026-11-10T12:00:00.000Z",
};

describe("Free tab and opening to everyone", () => {
  it("keeps free events with limited spots off Free, but a headcount RSVP stays", () => {
    const headcount = { ...limited, id: "evt-headcount", access: { kind: "rsvp" as const } };
    expect(isOpenFree(limited)).toBe(false);
    expect(isOpenFree(headcount)).toBe(true);
    const free = filterEvents([limited, headcount], { window: "today", freeOnly: true, now: NOW });
    expect(free.map((event) => event.id)).toEqual(["evt-headcount"]);
  });

  it("opens the event, puts it on Free, and tells students there is food left", async () => {
    const store = createMemoryStore([limited]);
    const feed = createMemoryAlertFeed(() => NOW);
    const result = await openToPublic(limited.id, { now: NOW, store, feed });
    expect(result.error).toBeNull();
    expect(result.data?.event.access).toEqual({ kind: "open" });
    expect(isOpenFree(result.data!.event)).toBe(true);
    expect(result.data?.alert?.kind).toBe("leftover_food");
    expect(result.data?.alert?.title).toContain("pizza");
  });

  it("refuses an unknown or finished event", async () => {
    const store = createMemoryStore([limited]);
    const feed = createMemoryAlertFeed(() => NOW);
    expect((await openToPublic("evt-nope", { now: NOW, store, feed })).error).toBe("No event with that id");
    const later = new Date("2026-11-12T21:00:00.000Z");
    expect((await openToPublic(limited.id, { now: later, store, feed })).error).toContain("ended");
  });
});
