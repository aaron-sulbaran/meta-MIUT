import { afterEach, describe, expect, it } from "vitest";
import { buildInterestMemory, getInterestMemory, recordSignals, resetInterestMemory, type InstagramSignal } from "@/lib/muse/memory";

const now = new Date("2026-11-12T16:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("buildInterestMemory", () => {
  it("scores long watches, comments, and saves above quick skips", () => {
    const signals: InstagramSignal[] = [
      { kind: "watch", at: hoursAgo(1), topics: ["film"], watchSeconds: 60, videoSeconds: 60 },
      { kind: "comment", at: hoursAgo(1), topics: ["film"], text: "so good" },
      { kind: "like", at: hoursAgo(1), topics: ["music"] },
      { kind: "watch", at: hoursAgo(1), topics: ["yoga"], watchSeconds: 1, videoSeconds: 30 },
    ];
    const memory = buildInterestMemory("u1", signals, now);
    expect(memory.topics.map((topic) => topic.topic)).toEqual(["film", "music"]);
    expect(memory.topics[0]!).toMatchObject({ score: 1, hook: "you comment on film posts" });
    expect(memory.topics[0]!.evidence).toContain("watched 1 video to the end");
  });

  it("weighs recent activity over old activity", () => {
    const memory = buildInterestMemory(
      "u1",
      [
        { kind: "like", at: hoursAgo(1), topics: ["film"] },
        { kind: "like", at: hoursAgo(24 * 60), topics: ["music"] },
      ],
      now,
    );
    expect(memory.topics[0]!.topic).toBe("film");
    expect(memory.topics[1]!.score).toBeLessThan(0.1);
  });
});

describe("interest memory store", () => {
  afterEach(() => resetInterestMemory());

  it("seeds the demo student and starts new users empty", () => {
    expect(getInterestMemory(undefined, now).topics[0]!.topic).toBe("rock climbing");
    expect(getInterestMemory("new-user", now).topics).toEqual([]);
  });

  it("remembers recorded signals per user", () => {
    recordSignals("new-user", [{ kind: "save", at: hoursAgo(1), topics: ["Yoga"] }], now);
    expect(getInterestMemory("new-user", now).topics.map((topic) => topic.topic)).toEqual(["yoga"]);
    expect(getInterestMemory("other-user", now).topics).toEqual([]);
  });
});
