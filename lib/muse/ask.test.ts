import { describe, expect, it } from "vitest";
import { asksForCrawl, holdActionsWhileAsking, routeCrawlRequest, type AskOutput } from "@/lib/muse/ask";

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

describe("Freebie Crawl requests", () => {
  it("spots crawl requests, not plain questions about free things", () => {
    for (const question of ["give me a path of free stuff.", "i want free food crawl", "Plan a freebie crawl", "walk me home past some swag"])
      expect(asksForCrawl(question)).toBe(true);
    for (const question of ["Any free concerts this week?", "what freebies are on today", "RSVP me to the pizza"])
      expect(asksForCrawl(question)).toBe(false);
  });

  it("adds the walk to a crawl request and drops a follow-up", () => {
    const routed = routeCrawlRequest({ ...base, followUp: "Which one?" }, "give me a path of free stuff", true);
    expect(routed.actions.some((action) => action.type === "plan_night")).toBe(true);
    expect(routed.followUp).toBeNull();
    expect(routed.eventIds).toEqual([]);
  });

  it("leaves other requests and planned walks alone", () => {
    expect(routeCrawlRequest(base, "Any free concerts this week?", true)).toBe(base);
    const planned = { ...base, actions: [{ type: "plan_night" as const, eventId: null, filter: null }] };
    expect(routeCrawlRequest(planned, "free food crawl", false)).toBe(planned);
  });
});
