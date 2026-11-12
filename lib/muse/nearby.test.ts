import { beforeEach, describe, expect, it } from "vitest";
import { compassDirection } from "@/lib/alerts/compose";
import { createMemoryAlertFeed } from "@/lib/alerts/feed";
import { loadSeedEvents } from "@/lib/events/seed";
import { createMemoryStore } from "@/lib/events/store";
import { DEMO_USER_ID } from "@/lib/muse/memory";
import { checkNearby, resetNearbyAlerts } from "@/lib/muse/nearby";

const NOW = new Date("2026-11-12T22:00:00.000Z");
const GDC = { lat: 30.2862, lng: -97.7366 };

function setup() {
  return { store: createMemoryStore(loadSeedEvents(NOW)), feed: createMemoryAlertFeed(() => NOW) };
}

describe("checkNearby", () => {
  beforeEach(() => resetNearbyAlerts());

  it("alerts each likely event nearby once, saying where it is", async () => {
    const options = setup();
    const first = await checkNearby({ userId: DEMO_USER_ID, location: GDC, now: NOW }, options);
    const ids = first.data?.alerts.map((alert) => alert.eventId);
    expect(ids).toEqual(expect.arrayContaining(["evt-acm-pizza-gdc", "evt-tacos-south-mall"]));
    const pizza = first.data?.alerts.find((alert) => alert.eventId === "evt-acm-pizza-gdc");
    expect(pizza?.title).toMatch(/near you: /);
    expect(pizza?.body).toMatch(/^Gates Dell Complex \(GDC\) 2\.216, right where you are, on now, \d+ min left$/);
    const tacos = first.data?.alerts.find((alert) => alert.eventId === "evt-tacos-south-mall");
    expect(tacos?.body).toMatch(/South Mall, \d+ min walk (south|southwest|west), starts in 25 min$/);

    const again = await checkNearby({ userId: DEMO_USER_ID, location: GDC, now: NOW }, options);
    expect(again.data?.alerts).toEqual([]);
    expect((await options.feed.listSince(0)).data?.alerts).toHaveLength(ids?.length ?? 0);
  });

  it("tracks each user separately and sends nothing far from campus", async () => {
    const options = setup();
    await checkNearby({ userId: DEMO_USER_ID, location: GDC, now: NOW }, options);
    const other = await checkNearby({ userId: "another-student", location: GDC, now: NOW }, options);
    expect(other.data?.alerts.length).toBeGreaterThan(0);
    const far = await checkNearby({ userId: "far-student", location: { lat: 30.4, lng: -97.6 }, now: NOW }, options);
    expect(far.data?.alerts).toEqual([]);
  });
});

describe("compassDirection", () => {
  it("names the way to walk", () => {
    expect(compassDirection({ lat: 30, lng: -97 }, { lat: 30.01, lng: -97 })).toBe("north");
    expect(compassDirection({ lat: 30, lng: -97 }, { lat: 30, lng: -96.99 })).toBe("east");
    expect(compassDirection({ lat: 30, lng: -97 }, { lat: 29.99, lng: -97.01 })).toBe("southwest");
  });
});
