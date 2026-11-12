import { describe, expect, it } from "vitest";
import { composeAlert } from "@/lib/alerts/compose";
import { createMemoryAlertFeed, type AlertFeed } from "@/lib/alerts/feed";
import { publishEvent, type PublishEventInput } from "@/lib/events/publish";
import { createMemoryStore } from "@/lib/events/store";

const NOW = new Date("2026-11-12T20:00:00.000Z");

const input: PublishEventInput = {
  title: "Fall Boulder Social",
  description: "All levels welcome.",
  start: "2026-11-12T20:20:00.000Z",
  end: "2026-11-12T21:50:00.000Z",
  place: { name: "Gregory Gym Climbing Wall", lat: 30.2843, lng: -97.7365 },
  free: true,
  food: true,
  foodNote: "pizza",
  access: { kind: "rsvp", capacity: 40 },
  organizer: { name: "Sample Climbing Club", handle: "sample_climbing" },
  source: { kind: "manual" },
};

describe("publishEvent", () => {
  it("stores a published event and sends the student an alert", async () => {
    const store = createMemoryStore([]);
    const feed = createMemoryAlertFeed(() => NOW);
    const result = await publishEvent(input, { now: NOW, store, feed });

    expect(result.error).toBeNull();
    const event = result.data?.event;
    expect(event?.status).toBe("published");
    expect(event?.id).toMatch(/^evt-fall-boulder-social-/);
    expect(event?.createdAt).toBe(NOW.toISOString());
    expect(await store.getEvent(event?.id ?? "")).toEqual(event);

    expect(result.data?.alert?.kind).toBe("free_food_nearby");
    expect(result.data?.alert?.eventId).toBe(event?.id);
    expect((await feed.listSince(0)).data?.alerts).toHaveLength(1);
  });

  it("keeps the event when the alert fails", async () => {
    const store = createMemoryStore([]);
    const brokenFeed: AlertFeed = {
      ...createMemoryAlertFeed(),
      async publish() {
        return { data: null, error: "feed down" };
      },
    };
    const result = await publishEvent(input, { now: NOW, store, feed: brokenFeed });
    expect(result.error).toBeNull();
    expect(result.data?.alert).toBeNull();
    expect(result.data?.alertError).toBe("feed down");
    expect(await store.listEvents()).toHaveLength(1);
  });

  it("returns the store error when the event is invalid", async () => {
    const result = await publishEvent(
      { ...input, end: input.start },
      { now: NOW, store: createMemoryStore([]), feed: createMemoryAlertFeed() },
    );
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe("composeAlert", () => {
  it("writes the free food banner with a relative start", async () => {
    const result = await publishEvent(input, {
      now: NOW,
      store: createMemoryStore([]),
      feed: createMemoryAlertFeed(),
    });
    const event = result.data?.event;
    if (!event) throw new Error("publish failed");
    expect(composeAlert(event, "free_food_nearby", NOW)).toEqual({
      kind: "free_food_nearby",
      eventId: event.id,
      title: "Free pizza nearby",
      body: "Fall Boulder Social at Gregory Gym Climbing Wall, starts in 20 min",
    });
    expect(composeAlert(event, "leftover_food", NOW).title).toBe("Leftover pizza, come grab it");
    expect(composeAlert(event, "new_event", new Date("2026-11-12T20:30:00.000Z")).body).toContain("happening now");
  });

  it("keeps the food label short", () => {
    const base = { ...input, id: "evt-1", status: "published" as const, createdAt: NOW.toISOString() };
    expect(composeAlert({ ...base, foodNote: "Pizza, vegetarian options" }, "free_food_nearby", NOW).title).toBe(
      "Free pizza nearby",
    );
    expect(composeAlert({ ...base, foodNote: undefined }, "free_food_nearby", NOW).title).toBe("Free food nearby");
    expect(
      composeAlert({ ...base, foodNote: "A whole spread of tacos from the place on Guadalupe" }, "free_food_nearby", NOW)
        .title,
    ).toBe("Free food nearby");
  });
});
