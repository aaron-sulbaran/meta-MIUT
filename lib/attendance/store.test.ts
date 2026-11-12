import { describe, expect, it } from "vitest";
import { EVENT_FULL_ERROR } from "@/lib/attendance/schema";
import {
  createMemoryAttendanceStore,
  createRedisAttendanceStore,
  type AttendanceStore,
} from "@/lib/attendance/store";
import { loadSeedEvents } from "@/lib/events/seed";
import type { CampusEvent } from "@/lib/events/schema";
import { createFakeRedis } from "@/tests/fake-redis";

const NOW = new Date("2026-11-12T20:00:00.000Z");

function baseEvent(): CampusEvent {
  const event = loadSeedEvents(NOW)[0];
  if (!event) throw new Error("seed is empty");
  return event;
}

const twoSeats: CampusEvent = { ...baseEvent(), id: "evt-two-seats", access: { kind: "rsvp", capacity: 2 } };
const openEvent: CampusEvent = { ...baseEvent(), id: "evt-open", access: { kind: "open" } };

const backends: [string, () => AttendanceStore][] = [
  ["memory", () => createMemoryAttendanceStore()],
  ["redis", () => createRedisAttendanceStore({ client: createFakeRedis().client, namespace: "test" })],
];

describe.each(backends)("%s attendance store", (_name, makeStore) => {
  it("starts empty and reports seats for capped events", async () => {
    const store = makeStore();
    expect((await store.summary(twoSeats, "viewer-aaaa")).data).toEqual({
      eventId: "evt-two-seats",
      interestedCount: 0,
      goingCount: 0,
      capacity: 2,
      seatsLeft: 2,
      viewer: { interested: false, going: false },
    });
    const open = (await store.summary(openEvent, null)).data;
    expect(open?.capacity).toBeNull();
    expect(open?.seatsLeft).toBeNull();
    expect(open?.viewer).toBeNull();
  });

  it("toggles interested per viewer and counts distinct viewers", async () => {
    const store = makeStore();
    await store.apply(openEvent, "viewer-aaaa", "interested");
    await store.apply(openEvent, "viewer-aaaa", "interested");
    const second = await store.apply(openEvent, "viewer-bbbb", "interested");
    expect(second.data?.interestedCount).toBe(2);
    expect(second.data?.viewer).toEqual({ interested: true, going: false });
    const undone = await store.apply(openEvent, "viewer-aaaa", "not_interested");
    expect(undone.data?.interestedCount).toBe(1);
    expect(undone.data?.viewer?.interested).toBe(false);
  });

  it("fills seats and refuses an RSVP once full", async () => {
    const store = makeStore();
    await store.apply(twoSeats, "viewer-aaaa", "rsvp");
    const full = await store.apply(twoSeats, "viewer-bbbb", "rsvp");
    expect(full.data?.seatsLeft).toBe(0);

    const refused = await store.apply(twoSeats, "viewer-cccc", "rsvp");
    expect(refused).toEqual({ data: null, error: EVENT_FULL_ERROR });

    const again = await store.apply(twoSeats, "viewer-aaaa", "rsvp");
    expect(again.error).toBeNull();
    expect(again.data?.goingCount).toBe(2);

    await store.apply(twoSeats, "viewer-aaaa", "cancel_rsvp");
    const freed = await store.apply(twoSeats, "viewer-cccc", "rsvp");
    expect(freed.data?.seatsLeft).toBe(0);
    expect(freed.data?.viewer).toEqual({ interested: false, going: true });
  });

  it("clearAll forgets everyone", async () => {
    const store = makeStore();
    await store.apply(twoSeats, "viewer-aaaa", "rsvp");
    await store.apply(openEvent, "viewer-aaaa", "interested");
    await store.clearAll();
    expect((await store.summary(twoSeats, "viewer-aaaa")).data?.goingCount).toBe(0);
    expect((await store.summary(openEvent, "viewer-aaaa")).data?.interestedCount).toBe(0);
  });
});
