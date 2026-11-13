import { describe, expect, it } from "vitest";
import { StageMoveSchema, applyMove } from "@/lib/demo/stage-position";

const NOW = new Date("2026-11-13T15:00:00Z");

describe("the stage position", () => {
  it("moves next and back from where it is, inside the beats", () => {
    const at7 = applyMove(null, { action: "goto", index: 7 }, 16, NOW);
    expect(at7.index).toBe(7);
    expect(applyMove(at7, { action: "next" }, 16, NOW).index).toBe(8);
    expect(applyMove(at7, { action: "back" }, 16, NOW).index).toBe(6);
    expect(applyMove(null, { action: "back" }, 16, NOW).index).toBe(0);
    expect(applyMove({ ...at7, index: 15 }, { action: "next" }, 16, NOW).index).toBe(15);
    expect(applyMove(null, { action: "goto", index: 99 }, 16, NOW).index).toBe(15);
  });

  it("always counts up, even for two moves in the same millisecond or after a restart", () => {
    const first = applyMove(null, { action: "next" }, 16, NOW);
    const second = applyMove(first, { action: "next" }, 16, NOW);
    expect(first.seq).toBe(NOW.getTime());
    expect(second.seq).toBe(NOW.getTime() + 1);
    // A restarted server has no record, but the clock keeps it ahead of what readers saw.
    expect(applyMove(null, { action: "next" }, 16, new Date(NOW.getTime() + 5_000)).seq).toBeGreaterThan(second.seq);
  });

  it("accepts only next, back, or a beat number", () => {
    expect(StageMoveSchema.safeParse({ action: "next" }).success).toBe(true);
    expect(StageMoveSchema.safeParse({ action: "goto", index: 3 }).success).toBe(true);
    expect(StageMoveSchema.safeParse({ action: "goto", index: -1 }).success).toBe(false);
    expect(StageMoveSchema.safeParse({ action: "reset" }).success).toBe(false);
  });
});
