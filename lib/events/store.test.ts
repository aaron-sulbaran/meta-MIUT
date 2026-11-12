import { describe, expect, it, vi } from "vitest";
import { loadSeedEvents } from "@/lib/events/seed";
import { createMemoryStore, createRedisEventStore } from "@/lib/events/store";
import { createFakeRedis } from "@/tests/fake-redis";

const NOW = new Date("2026-11-12T20:00:00.000Z");

function firstSeed() {
  const event = loadSeedEvents(NOW)[0];
  if (!event) throw new Error("seed is empty");
  return event;
}

function makeRedisStore() {
  const redis = createFakeRedis();
  const fallback = createMemoryStore([firstSeed()]);
  const store = createRedisEventStore({ client: redis.client, namespace: "test", fallback, now: () => NOW });
  return { redis, store, fallback };
}

describe("memory store", () => {
  it("resets to a fresh seed and drops added events", async () => {
    const seed = loadSeedEvents(NOW);
    const store = createMemoryStore(seed);
    await store.upsertEvent({ ...firstSeed(), id: "evt-extra" });
    expect(await store.getEvent("evt-extra")).not.toBeNull();
    const reset = await store.resetToSeed(NOW);
    expect(reset).toEqual({ data: seed.length, error: null });
    expect(await store.getEvent("evt-extra")).toBeNull();
  });
});

describe("redis store", () => {
  it("seeds on first read, once", async () => {
    const { redis, store } = makeRedisStore();
    const seedCount = loadSeedEvents(NOW).length;
    expect(await store.listEvents()).toHaveLength(seedCount);
    expect(await store.listEvents()).toHaveLength(seedCount);
    const seedWrites = redis.log.filter(([name, key]) => name === "HSET" && key === "test:events");
    expect(seedWrites).toHaveLength(1);
  });

  it("does not re-seed when another instance already seeded", async () => {
    const redis = createFakeRedis();
    redis.strings.set("test:events:seeded", "earlier");
    const store = createRedisEventStore({
      client: redis.client,
      namespace: "test",
      fallback: createMemoryStore([]),
      now: () => NOW,
    });
    expect(await store.listEvents()).toEqual([]);
  });

  it("stores a published event where every instance can read it", async () => {
    const { redis, store } = makeRedisStore();
    const event = { ...firstSeed(), id: "evt-new", title: "New thing" };
    expect((await store.upsertEvent(event)).error).toBeNull();

    const otherInstance = createRedisEventStore({
      client: redis.client,
      namespace: "test",
      fallback: createMemoryStore([]),
      now: () => NOW,
    });
    expect((await otherInstance.getEvent("evt-new"))?.title).toBe("New thing");
  });

  it("rejects an invalid event without writing", async () => {
    const { redis, store } = makeRedisStore();
    const event = { ...firstSeed(), id: "evt-bad", end: "2000-01-01T00:00:00.000Z" };
    const result = await store.upsertEvent(event);
    expect(result.error).not.toBeNull();
    expect(redis.hashes.get("test:events")?.has("evt-bad") ?? false).toBe(false);
  });

  it("falls back to memory when Redis fails on a read", async () => {
    const { redis, store } = makeRedisStore();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    redis.failNext();
    const events = await store.listEvents();
    expect(events).toHaveLength(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns the error when Redis fails on a write", async () => {
    const { redis, store } = makeRedisStore();
    await store.listEvents();
    redis.failNext();
    const result = await store.upsertEvent({ ...firstSeed(), id: "evt-new" });
    expect(result.error).toContain("simulated failure");
  });

  it("reset replaces everything with the seed", async () => {
    const { store } = makeRedisStore();
    await store.upsertEvent({ ...firstSeed(), id: "evt-new" });
    const reset = await store.resetToSeed(NOW);
    expect(reset.error).toBeNull();
    expect(await store.getEvent("evt-new")).toBeNull();
    expect(await store.listEvents()).toHaveLength(loadSeedEvents(NOW).length);
  });
});
