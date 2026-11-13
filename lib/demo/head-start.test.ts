import { beforeEach, describe, expect, it, vi } from "vitest";
import { HEAD_START_HEADER, resetHeadStart, shareAnswer, storyExtractKey, walkHomeKey } from "@/lib/demo/head-start";
import { walkHomeRequest } from "@/lib/demo/walk-home";
import { storyCaptionNow } from "@/lib/demo/story-fixtures";
import { callMuse, withoutMuse } from "@/lib/muse/client";
import { resetClaims } from "@/lib/store/state";

vi.mock("@/lib/demo/stage-position", () => ({ readStagePosition: async () => null }));

const ask = (headStart = false) => new Request("http://local/api", { method: "POST", headers: headStart ? { [HEAD_START_HEADER]: "1" } : {} });
const live = (picks: string) => ({ data: { picks }, error: null, source: "muse" });
const recordedBody = { data: { picks: "recorded" }, error: null, source: "fixture" };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the demo's head start", () => {
  beforeEach(() => {
    resetHeadStart();
    resetClaims();
  });

  it("shares one live call between the stage's head start and the screen, with the real time it took", async () => {
    const run = vi.fn(async () => {
      await sleep(40);
      return live("abc");
    });
    const recorded = vi.fn(async () => recordedBody);
    const early = shareAnswer({ key: "k", request: ask(true), run, recorded });
    const screen = await shareAnswer({ key: "k", request: ask(), run, recorded, budgetMs: 2000 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(recorded).not.toHaveBeenCalled();
    expect(screen.body.source).toBe("muse");
    expect(screen.body.museMs).toBeGreaterThanOrEqual(30);
    expect((await early).body.museMs).toBe(screen.body.museMs);
    const later = await shareAnswer({ key: "k", request: ask(), run, recorded });
    expect(later.how).toBe("joined");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives the recorded answer past the budget, and keeps it for the run when the live one lands later", async () => {
    const run = vi.fn(async () => {
      await sleep(120);
      return live("late");
    });
    const recorded = vi.fn(async () => recordedBody);
    const first = await shareAnswer({ key: "slow", request: ask(), run, recorded, budgetMs: 30 });
    expect(first.how).toBe("recorded-budget");
    expect(first.body).toMatchObject({ source: "fixture", museMs: null });
    await sleep(150);
    const second = await shareAnswer({ key: "slow", request: ask(), run, recorded, budgetMs: 30 });
    expect(second.how).toBe("recorded-kept");
    expect(second.body.source).toBe("fixture");
  });

  it("never keeps a failed call: the next screen asks again", async () => {
    const failing = vi.fn(async () => ({ data: { picks: "fixture" }, error: null, source: "fixture" }));
    const recorded = vi.fn(async () => recordedBody);
    await shareAnswer({ key: "f", request: ask(), run: failing, recorded, budgetMs: 500 });
    resetClaims();
    await shareAnswer({ key: "f", request: ask(), run: failing, recorded, budgetMs: 500 });
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("switches Muse off inside the recorded path only", async () => {
    vi.stubEnv("MUSE_API_KEY", "test-key");
    const off = await withoutMuse("Muse did not answer within 8 s", () => callMuse({ system: "s", prompt: "p" }));
    expect(off).toMatchObject({ data: null, error: "Muse did not answer within 8 s", meta: null });
    vi.unstubAllEnvs();
  });

  it("keys only the story's flyer and the walk home exactly as the map asks it", () => {
    const caption = storyCaptionNow();
    expect(storyExtractKey({ caption, imageBase64: "x" })).toContain("flyer");
    expect(storyExtractKey({ caption: "Bake sale tomorrow", imageBase64: "x" })).toBeNull();
    expect(storyExtractKey({ caption, spoken: true })).toBeNull();
    const walk = walkHomeRequest({ lat: 42.36, lng: -71.09 }, "2026-11-13T20:05:00.000Z");
    expect(walkHomeKey(walk)).toBe(walkHomeKey({ ...walk }));
    expect(walkHomeKey({ ...walk, note: "meeting Lisa" })).toBeNull();
    expect(walkHomeKey({ ...walk, at: "2026-11-13T20:06:00.000Z" })).not.toBe(walkHomeKey(walk));
  });
});

describe("a head start whose call failed", () => {
  beforeEach(() => {
    resetHeadStart();
    resetClaims();
  });

  it("lets the screen ask again at once, inside the budget, instead of waiting on the failed claim", async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? { data: { picks: "fixture" }, error: null, source: "fixture" } : live("second");
    });
    const recorded = vi.fn(async () => recordedBody);
    await shareAnswer({ key: "x", request: ask(true), run, recorded });
    const started = Date.now();
    const screen = await shareAnswer({ key: "x", request: ask(), run, recorded, budgetMs: 2000 });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(screen.body.source).toBe("muse");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps the budget while it waits on someone else's call", async () => {
    const never = vi.fn(() => new Promise<{ source: string; data: unknown }>(() => {}));
    const recorded = vi.fn(async () => recordedBody);
    void shareAnswer({ key: "y", request: ask(true), run: never, recorded });
    await sleep(5);
    resetHeadStart();
    const started = Date.now();
    const screen = await shareAnswer({ key: "y", request: ask(), run: never, recorded, budgetMs: 60 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(screen.how).toBe("recorded-budget");
  });
});
