import { beforeEach, describe, expect, it } from "vitest";
import { resetSharedAnswers, sharedAnswer } from "@/lib/store/shared-answer";
import { resetClaims } from "@/lib/store/state";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("a shared answer's honesty stamp", () => {
  beforeEach(() => {
    resetSharedAnswers();
    resetClaims();
  });

  it("gives the second reader the first call's own time and source, never the time it took to read a cache", async () => {
    const run = async () => {
      await sleep(60);
      return { data: { picks: ["a"] }, error: null, source: "muse" };
    };
    const first = (await sharedAnswer("curate:user3", run, 1000)) as { museMs: number; source: string };
    expect(first.museMs).toBeGreaterThanOrEqual(50);
    const second = (await sharedAnswer("curate:user3", run, 1000)) as { museMs: number; source: string };
    expect(second.source).toBe("muse");
    expect(second.museMs).toBe(first.museMs);
  });

  it("gives a reader who asks mid-call the same time, and a recorded answer no time", async () => {
    const run = async () => {
      await sleep(40);
      return { data: { picks: ["a"] }, error: null, source: "muse" };
    };
    const [first, waiting] = (await Promise.all([sharedAnswer("going:a", run, 1000), sharedAnswer("going:a", run, 1000)])) as { museMs: number }[];
    expect(waiting!.museMs).toBe(first!.museMs);
    const recorded = (await sharedAnswer("going:b", async () => ({ data: { picks: [] }, error: null, source: "fixture" }), 1000)) as { museMs: unknown };
    expect(recorded.museMs).toBeNull();
  });
});
