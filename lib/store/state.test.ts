import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadTurns, resetConversations, saveTurns } from "@/lib/muse/conversation";
import { getInterestMemory, loadInterestMemory, resetInterestMemory, saveSignals } from "@/lib/muse/memory";
import type { RedisClient } from "@/lib/store/redis";
import { loadState, saveState, setStateClient } from "@/lib/store/state";

function fakeRedis(): RedisClient & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async command([name, key, value]) {
      if (name === "GET") return { data: values.get(String(key)) ?? null, error: null };
      if (name === "SET") {
        values.set(String(key), String(value));
        return { data: "OK", error: null };
      }
      return { data: null, error: `unsupported ${name}` };
    },
    async pipeline() {
      return { data: null, error: "unsupported pipeline" };
    },
  };
}

const now = new Date("2026-11-12T20:00:00-05:00");

describe("shared state", () => {
  afterEach(() => {
    setStateClient(undefined);
    resetInterestMemory();
    resetConversations();
  });

  it("is a no-op without Redis", async () => {
    setStateClient(null);
    await saveState("x", [1]);
    expect(await loadState("x", z.array(z.number()))).toBeNull();
  });

  it("brings interest memory and Ask Muse turns back after the process forgets them", async () => {
    const redis = fakeRedis();
    setStateClient(redis);
    await saveSignals("u1", [{ kind: "save", at: now.toISOString(), topics: ["chess"] }], now);
    await saveTurns("u1", [{ role: "student", text: "any chess?", at: now.toISOString() }]);

    resetInterestMemory();
    resetConversations();
    expect(getInterestMemory("u1", now).topics).toEqual([]);

    expect((await loadInterestMemory("u1", now)).topics.map((topic) => topic.topic)).toEqual(["chess"]);
    expect((await loadTurns("u1")).map((turn) => turn.text)).toEqual(["any chess?"]);
  });

  it("ignores a stored value that no longer matches the schema", async () => {
    const redis = fakeRedis();
    setStateClient(redis);
    await saveState("bad", { not: "a list" });
    expect(await loadState("bad", z.array(z.string()))).toBeNull();
  });
});
