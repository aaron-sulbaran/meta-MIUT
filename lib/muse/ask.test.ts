import { describe, expect, it } from "vitest";
import { holdActionsWhileAsking, type AskOutput } from "@/lib/muse/ask";

const base: AskOutput = {
  answer: "A few things are on.",
  eventIds: ["evt-a"],
  actions: [
    { type: "rsvp", eventId: "evt-a", filter: null },
    { type: "filter", eventId: null, filter: "free" },
  ],
  followUp: null,
  learnedTopics: [],
};

describe("holdActionsWhileAsking", () => {
  it("keeps every action when Muse is not asking anything", () => {
    expect(holdActionsWhileAsking(base).actions).toHaveLength(2);
  });

  it("holds RSVP and other changes until the follow-up is answered, but still shows things", () => {
    const held = holdActionsWhileAsking({ ...base, followUp: "Which one, the 6 PM or the 8 PM?" });
    expect(held.actions).toEqual([{ type: "filter", eventId: null, filter: "free" }]);
  });
});
