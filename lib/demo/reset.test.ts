import { afterEach, describe, expect, it } from "vitest";
import { DEMO_STATE_PREFIXES, resetDemo } from "@/lib/demo/reset";
import { recentTurns, remember } from "@/lib/muse/conversation";
import { recordSignals, signalsFor } from "@/lib/muse/memory";
import { deleteStatePrefixes, loadState, saveState, setStateClient } from "@/lib/store/state";
import { createFakeRedis } from "@/tests/fake-redis";
import { z } from "zod";

const NOW = new Date("2026-11-12T20:00:00.000Z");

afterEach(() => setStateClient(undefined));

describe("deleteStatePrefixes", () => {
  it("deletes every saved value under the prefixes and nothing else", async () => {
    setStateClient(createFakeRedis().client);
    await saveState("muse-signals:lisa", [1]);
    await saveState("muse-signals:user3", [2]);
    await saveState("social-going:evt-1", [3]);
    await saveState("crawl-plan:keep", [4]);

    const result = await deleteStatePrefixes(["muse-signals:", "social-going:"]);
    expect(result).toEqual({ data: 3, error: null });
    expect(await loadState("muse-signals:lisa", z.array(z.number()))).toBeNull();
    expect(await loadState("crawl-plan:keep", z.array(z.number()))).toEqual([4]);
  });

  it("deletes nothing when there is no shared store", async () => {
    setStateClient(null);
    expect(await deleteStatePrefixes([...DEMO_STATE_PREFIXES])).toEqual({ data: 0, error: null });
  });
});

describe("resetDemo", () => {
  it("clears every persona's Muse memory and Ask history held in this process", async () => {
    setStateClient(null);
    recordSignals("lisa", [{ kind: "like", at: NOW.toISOString(), topics: ["climbing"] }], NOW);
    remember("user3", [{ role: "student", text: "anything free tonight?", at: NOW.toISOString() }]);
    expect(signalsFor("lisa", NOW)).toHaveLength(1);
    expect(recentTurns("user3")).toHaveLength(1);

    const result = await resetDemo(NOW);

    expect(result.error).toBeNull();
    expect(result.data?.events).toBeGreaterThan(0);
    expect(signalsFor("lisa", NOW)).toHaveLength(0);
    expect(recentTurns("user3")).toHaveLength(0);
  });
});
