import { beforeEach, describe, expect, it } from "vitest";
import { MAX_TURNS, recentTurns, remember, resetConversations } from "@/lib/muse/conversation";
import { rejectUnknownIds, type AskOutput } from "@/lib/muse/ask";

const at = "2026-11-12T20:00:00-05:00";

describe("conversation memory", () => {
  beforeEach(() => resetConversations());

  it("keeps each student's turns apart and only the latest MAX_TURNS", () => {
    for (let index = 0; index < MAX_TURNS + 3; index += 1) remember("a", [{ role: "student", text: `q${index}`, at }]);
    remember("b", [{ role: "student", text: "hi", at }]);
    expect(recentTurns("a")).toHaveLength(MAX_TURNS);
    expect(recentTurns("a").at(-1)?.text).toBe(`q${MAX_TURNS + 2}`);
    expect(recentTurns("b")).toEqual([{ role: "student", text: "hi", at }]);
  });
});

describe("rejectUnknownIds", () => {
  const output = (eventIds: string[], actionId: string | null): AskOutput => ({
    answer: "ok",
    eventIds,
    actions: [{ type: "rsvp", eventId: actionId, filter: null }],
    followUp: null,
    learnedTopics: [],
  });

  it("accepts known ids in answers and actions, and rejects unknown ones", () => {
    const known = new Set(["evt-a"]);
    expect(rejectUnknownIds(output(["evt-a"], "evt-a"), known)).toBeNull();
    expect(rejectUnknownIds(output(["evt-a"], null), known)).toBeNull();
    expect(rejectUnknownIds(output(["evt-a"], "evt-x"), known)).toContain("unknown");
    expect(rejectUnknownIds(output(["evt-x"], null), known)).toContain("unknown");
  });
});
