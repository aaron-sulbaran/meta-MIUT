import { describe, expect, it } from "vitest";
import { BEATS } from "@/lib/demo/beats";
import { FAST_POLL_MS, QUIET_AFTER_MS, SLOW_POLL_MS, pollDelay } from "@/lib/demo/stage-poll";
import { READ_SHARE_MS, moveStage, readStagePosition } from "@/lib/demo/stage-position";
import { setStateClient } from "@/lib/store/state";
import type { RedisClient } from "@/lib/store/redis";

const o1 = BEATS.findIndex((beat) => beat.id === "O1");
const NOW = 1_800_000_000_000;

describe("how often a screen asks where the stage is", () => {
  it("asks fast while the skit is moving, slow once it has been quiet, and not at all when hidden", () => {
    expect(pollDelay({ hidden: false, index: o1, lastActivityAt: NOW - 10_000, now: NOW })).toBe(FAST_POLL_MS);
    expect(pollDelay({ hidden: false, index: o1, lastActivityAt: NOW - QUIET_AFTER_MS - 1, now: NOW })).toBe(SLOW_POLL_MS);
    expect(pollDelay({ hidden: true, index: o1, lastActivityAt: NOW, now: NOW })).toBeNull();
  });

  it("asks slowly on the opening and closing beats", () => {
    expect(pollDelay({ hidden: false, index: 0, lastActivityAt: NOW, now: NOW })).toBe(SLOW_POLL_MS);
    expect(pollDelay({ hidden: false, index: BEATS.length - 1, lastActivityAt: NOW, now: NOW })).toBe(SLOW_POLL_MS);
  });
});

describe("one shared store read per server instance", () => {
  it("answers any number of readers in a window with one Redis read, and a move is seen at once", async () => {
    let gets = 0;
    let stored: string | null = null;
    const redis: RedisClient = {
      async command(command) {
        if (command[0] === "GET") {
          gets += 1;
          return { data: stored, error: null };
        }
        if (command[0] === "SET") stored = String(command[2]);
        return { data: "OK", error: null };
      },
      async pipeline() {
        return { data: [], error: null };
      },
    };
    setStateClient(redis);
    try {
      const start = NOW + 10 * 60_000;
      await Promise.all(Array.from({ length: 20 }, () => readStagePosition(start)));
      await readStagePosition(start + READ_SHARE_MS - 1);
      expect(gets).toBe(1);
      await readStagePosition(start + READ_SHARE_MS);
      expect(gets).toBe(2);
      // A move on this instance updates the shared copy: readers see it without another read.
      const moved = await moveStage({ action: "goto", index: o1 }, new Date(start + READ_SHARE_MS + 1));
      const before = gets;
      expect((await readStagePosition(Date.now()))?.index).toBe(moved.index);
      expect(gets).toBe(before);
    } finally {
      setStateClient(undefined);
    }
  });
});
