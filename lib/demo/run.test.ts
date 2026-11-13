import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DEMO_STATE_PREFIXES, resetDemo } from "@/lib/demo/reset";
import { isStaleRun, newRunId, STALE_RUN_MS } from "@/lib/demo/run";
import { readSaid, writeSaid } from "@/lib/demo/said";
import { applyMove, moveStage, readStagePosition, startRun, StagePositionSchema } from "@/lib/demo/stage-position";
import { STORY_FALLBACK_ID } from "@/lib/demo/story-data";
import { createMemoryAlertFeed } from "@/lib/alerts/feed";
import { publishEvent, type PublishEventInput } from "@/lib/events/publish";
import { createMemoryStore, withoutDuplicates } from "@/lib/events/store";
import type { CampusEvent } from "@/lib/events/schema";
import { recordSignals, signalsFor } from "@/lib/muse/memory";
import { recentTurns, remember } from "@/lib/muse/conversation";
import { followRun, loadState, RUN_CHECK_MS, saveState, setStateClient } from "@/lib/store/state";
import { createFakeRedis } from "@/tests/fake-redis";

const NOW = new Date("2026-11-13T09:00:00.000Z");
const spoken = { text: "find us something closer to Lisa", by: "voice" as const, view: { line: "Moved you to Kendall." } };

afterEach(() => setStateClient(undefined));

describe("a run", () => {
  it("has a new id each time, and moves keep the run they were made in", () => {
    expect(newRunId(NOW)).not.toBe(newRunId(NOW));
    const first = applyMove(null, { action: "goto", index: 0 }, 30, NOW);
    expect(first.run).toMatch(/^run-/);
    const next = applyMove(first, { action: "next" }, 30, new Date(NOW.getTime() + 1000));
    expect(next.run).toBe(first.run);
    expect(next.furthest).toBe(1);
    const back = applyMove(next, { action: "back" }, 30, new Date(NOW.getTime() + 2000));
    expect(back).toMatchObject({ run: first.run, index: 0, furthest: 1 });
  });

  it("is old once it was played and nothing moved for about 20 minutes, never just for sitting on the opening", () => {
    const played = { index: 4, run: "run-a", movedAt: NOW.toISOString(), furthest: 7 };
    expect(isStaleRun(played, NOW.getTime() + 5 * 60_000)).toBe(false);
    expect(isStaleRun(played, NOW.getTime() + STALE_RUN_MS + 1)).toBe(true);
    const fresh = { index: 0, run: "run-b", movedAt: NOW.toISOString(), furthest: 0 };
    expect(isStaleRun(fresh, NOW.getTime() + 3 * 60 * 60_000)).toBe(false);
    // A record from before runs existed reads as an old run.
    expect(isStaleRun({ index: 9, at: NOW.toISOString() }, NOW.getTime())).toBe(true);
  });
});

describe("the fresh run", () => {
  it("clears every saved piece of demo state, starts a new run on the first beat, and names what it cleared", async () => {
    const redis = createFakeRedis();
    setStateClient(redis.client);
    await moveStage({ action: "goto", index: 12 }, NOW);
    const before = await readStagePosition(Date.now() + 10_000);
    // One saved value under every prefix the reset knows, plus the ones added tonight by name.
    for (const prefix of DEMO_STATE_PREFIXES) await saveState(`${prefix}x`, [1]);
    for (const name of ["social-hellos", "social-hellos-notes", "shared-answer:curate:user3", "demo-phone-seen:jing", "demo-said:sample-student", "claim:hello-write:e:v", "claim:story-publish"]) {
      await saveState(name, [1]);
    }
    await saveState("crawl-plan:keep", [2]);

    const result = await resetDemo(NOW);
    expect(result.error).toBeNull();
    for (const prefix of DEMO_STATE_PREFIXES) expect(await loadState(`${prefix}x`, z.array(z.number()))).toBeNull();
    for (const name of ["social-hellos", "social-hellos-notes", "shared-answer:curate:user3", "demo-phone-seen:jing", "demo-said:sample-student", "claim:hello-write:e:v", "claim:story-publish"]) {
      expect(await loadState(name, z.array(z.number()))).toBeNull();
    }
    expect(await loadState("crawl-plan:keep", z.array(z.number()))).toEqual([2]);

    const after = await loadState("demo-stage", StagePositionSchema);
    expect(after).toMatchObject({ index: 0, furthest: 0, run: result.data?.run });
    expect(after?.run).not.toBe(before?.run);
    expect(after?.signal ?? null).toBeNull();
    expect(after?.deck ?? null).toBeNull();
    expect(result.data?.cleared.length).toBeGreaterThan(5);
  });

  it("makes every other server instance drop what it holds in memory from the last run", async () => {
    const redis = createFakeRedis();
    setStateClient(redis.client);
    await startRun(NOW);
    recordSignals("run-test-person", [{ kind: "like", at: NOW.toISOString(), topics: ["boardgames"] }], NOW);
    remember("sample-student", [{ role: "student", text: "anything free tonight?", at: NOW.toISOString() }]);
    expect(signalsFor("run-test-person", NOW)).toHaveLength(1);

    // Another instance starts a new run: only the stored record changes.
    await redis.client.command(["SET", `${(await import("@/lib/store/redis")).storeNamespace()}:state:demo-stage`, JSON.stringify({ index: 0, seq: 1, at: NOW.toISOString(), run: "run-other" })]);
    await followRun(Date.now() + RUN_CHECK_MS + 1);

    expect(signalsFor("run-test-person", NOW)).toHaveLength(0);
    expect(recentTurns("sample-student")).toHaveLength(0);
  });
});

describe("what a presenter said, per run", () => {
  it("carries between beats within a run and survives a reload, but never shows in the next run", async () => {
    setStateClient(createFakeRedis().client);
    await startRun(NOW);
    await writeSaid("sample-student", spoken, NOW);
    await moveStage({ action: "next" }, new Date(NOW.getTime() + 1000));
    expect((await readSaid("sample-student"))?.text).toBe(spoken.text);

    // A new run with the old record still held somewhere (another instance's memory, a missed key).
    await startRun(new Date(NOW.getTime() + 60_000));
    expect(await readSaid("sample-student")).toBeNull();
  });
});

describe("the story event", () => {
  const draft: PublishEventInput = {
    title: "Board Game Night + Free Dumplings",
    description: "Drop in after class.",
    start: "2026-11-13T21:25:00.000Z",
    end: "2026-11-13T23:25:00.000Z",
    place: { name: "MIT Museum, 314 Main St", lat: 42.3624, lng: -71.0879 },
    free: true,
    food: true,
    access: { kind: "open" },
    organizer: { name: "MIT Board Game Club", handle: "@MIT_BoardGames" },
    source: { kind: "instagram" },
  };

  it("is one event per run however many times it is published, with one alert", async () => {
    setStateClient(null);
    await resetDemo(NOW);
    const store = createMemoryStore([]);
    const feed = createMemoryAlertFeed(() => NOW);
    const first = await publishEvent(draft, { now: NOW, store, feed, viewerLocation: { lat: 42.36, lng: -71.09 } });
    const again = await publishEvent({ ...draft, title: "Board Game Night and Free Dumplings" }, { now: NOW, store, feed, viewerLocation: { lat: 42.36, lng: -71.09 } });
    expect(first.data?.event.id).toBe(STORY_FALLBACK_ID);
    expect(again.data?.event.id).toBe(STORY_FALLBACK_ID);
    expect(await store.listEvents()).toHaveLength(1);
    expect(first.data?.alert).not.toBeNull();
    expect(again.data?.alert).toBeNull();
  });

  it("never lists the same event twice", () => {
    const base = { ...draft, id: "evt-a", status: "published", createdAt: NOW.toISOString(), organizer: { name: "MIT Board Game Club", handle: "mit_boardgames" } } as CampusEvent;
    const copy = { ...base, id: "evt-b", createdAt: new Date(NOW.getTime() + 1000).toISOString() };
    const story = { ...base, id: STORY_FALLBACK_ID, createdAt: new Date(NOW.getTime() - 1000).toISOString() };
    const other = { ...base, id: "evt-c", title: "Chess night" };
    expect(withoutDuplicates([base, copy, other]).map((event) => event.id)).toEqual(["evt-b", "evt-c"]);
    expect(withoutDuplicates([base, story, copy]).map((event) => event.id)).toEqual([STORY_FALLBACK_ID]);
  });
});
