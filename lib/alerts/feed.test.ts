import { describe, expect, it } from "vitest";
import { createMemoryAlertFeed, createRedisAlertFeed, type AlertFeed } from "@/lib/alerts/feed";
import type { AlertDraft } from "@/lib/alerts/schema";
import { createFakeRedis } from "@/tests/fake-redis";

const NOW = new Date("2026-11-12T20:00:00.000Z");

function draft(eventId: string): AlertDraft {
  return { kind: "new_event", eventId, title: "Something nearby", body: "Details" };
}

const backends: [string, () => AlertFeed][] = [
  ["memory", () => createMemoryAlertFeed(() => NOW)],
  ["redis", () => createRedisAlertFeed({ client: createFakeRedis().client, namespace: "test", now: () => NOW })],
];

describe.each(backends)("%s alert feed", (_name, makeFeed) => {
  it("hands out increasing seq and lists alerts after a cursor", async () => {
    const feed = makeFeed();
    const first = await feed.publish(draft("evt-1"));
    const second = await feed.publish(draft("evt-2"));
    expect(first.data?.seq).toBe(1);
    expect(second.data?.seq).toBe(2);

    const all = await feed.listSince(0);
    expect(all.data?.alerts.map((alert) => alert.eventId)).toEqual(["evt-1", "evt-2"]);
    expect(all.data?.cursor).toBe(2);

    const newer = await feed.listSince(1);
    expect(newer.data?.alerts.map((alert) => alert.eventId)).toEqual(["evt-2"]);

    const none = await feed.listSince(2);
    expect(none.data).toEqual({ alerts: [], cursor: 2 });
  });

  it("reports the latest cursor", async () => {
    const feed = makeFeed();
    expect((await feed.latestCursor()).data).toBe(0);
    await feed.publish(draft("evt-1"));
    expect((await feed.latestCursor()).data).toBe(1);
  });

  it("clamps a cursor that is ahead of the feed so new alerts still arrive", async () => {
    const feed = makeFeed();
    await feed.publish(draft("evt-1"));
    const ahead = await feed.listSince(50);
    expect(ahead.data).toEqual({ alerts: [], cursor: 1 });
    await feed.publish(draft("evt-2"));
    const next = await feed.listSince(ahead.data?.cursor ?? 0);
    expect(next.data?.alerts.map((alert) => alert.eventId)).toEqual(["evt-2"]);
  });

  it("clear drops alerts but keeps counting", async () => {
    const feed = makeFeed();
    await feed.publish(draft("evt-1"));
    await feed.clear();
    expect((await feed.listSince(0)).data?.alerts).toEqual([]);
    expect((await feed.publish(draft("evt-2"))).data?.seq).toBe(2);
  });
});
