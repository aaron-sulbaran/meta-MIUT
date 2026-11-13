import { describe, expect, it } from "vitest";
import { storyFallbackEvent } from "@/lib/demo/story";
import { isStoryCaption, storyAskFixture, storyCrawlFixture, storyExtractFixture, storyInviteMessage } from "@/lib/demo/story-fixtures";
import { REPLAN_LINE, storyCaption } from "@/lib/demo/staged";
import { ExtractOutputSchema } from "@/lib/muse/extract";
import { AskOutputSchema } from "@/lib/muse/ask";
import { CrawlPickSchema } from "@/lib/muse/crawl";

const now = new Date("2026-11-13T20:05:00Z");
const story = storyFallbackEvent([], now);

describe("the demo story's recorded answers", () => {
  it("recognize the story's caption and nothing else", () => {
    expect(isStoryCaption(storyCaption(now))).toBe(true);
    expect(isStoryCaption("Free pho night! Lobdell Dining Hall")).toBe(false);
  });

  it("draft Board Game Night from the caption, valid for the extract schema", () => {
    const draft = storyExtractFixture(storyCaption(now), now);
    expect(ExtractOutputSchema.safeParse(draft).success).toBe(true);
    expect(draft.title).toBe("Board Game Night");
    expect(draft.start).toBe(story.start);
    expect(draft.evidence.start?.from).toBe("caption");
  });

  it("answer the re-plan with the story event and the invite, and nothing else", () => {
    const answer = storyAskFixture(REPLAN_LINE, [story]);
    expect(AskOutputSchema.safeParse(answer).success).toBe(true);
    expect(answer?.actions.map((action) => action.type)).toEqual(["plan_night", "invite_friend"]);
    expect(answer?.eventIds).toEqual([story.id]);
    expect(storyAskFixture("Any free concerts this week?", [story])).toBeNull();
  });

  it("keep the story event on the walk to it and invite to it", () => {
    const generic = { stops: [], pitch: "Out of class?", invite: { eventId: null, message: "Want to hang out?" } };
    const walk = storyCrawlFixture(generic, [story], { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 0 }, note: `${REPLAN_LINE} (Board Game Night at MIT Museum)` });
    expect(CrawlPickSchema.safeParse(walk).success).toBe(true);
    expect(walk?.invite).toEqual({ eventId: story.id, message: storyInviteMessage() });
    expect(walk?.stops.some((stop) => stop.eventId === story.id)).toBe(true);
  });
});
