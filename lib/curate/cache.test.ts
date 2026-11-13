import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURATE_CACHE_MS, cachedCurate, resetCurateCache } from "@/lib/curate/cache";
import { resetClaims } from "@/lib/store/state";

describe("the shared curate answer", () => {
  beforeEach(() => {
    resetCurateCache();
    resetClaims();
  });

  it("gives the second reader the first reader's answer, even while the first is still asking", async () => {
    const run = vi.fn(async () => ({ data: { picks: ["a", "b", "c"] } }));
    const [first, second] = await Promise.all([cachedCurate("user3", run, 1000), cachedCurate("user3", run, 1000)]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("asks again after two minutes, per viewer, and never keeps a failed answer", async () => {
    const run = vi.fn(async () => ({ data: { picks: [] } }));
    await cachedCurate("user3", run, 1000);
    await cachedCurate("lisa", run, 1000);
    await cachedCurate("user3", run, 1000 + CURATE_CACHE_MS + 1);
    expect(run).toHaveBeenCalledTimes(3);
    resetCurateCache();
    resetClaims();
    const failing = vi.fn(async () => ({ data: null, error: "no" }));
    await cachedCurate("user3", failing, 5000);
    resetClaims();
    await cachedCurate("user3", failing, 5000);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
