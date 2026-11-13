import { describe, expect, it } from "vitest";
import { storyFallbackEvent } from "@/lib/demo/story";
import { isStoryCaption, storyAskFixture, storyCrawlFixture, storyExtractFixture, storyInviteMessage, withStoryTitle } from "@/lib/demo/story-fixtures";
import { STORY } from "@/lib/demo/story-data";
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

  it("draft the story title from the caption, valid for the extract schema", () => {
    const draft = storyExtractFixture(storyCaption(now), now);
    expect(ExtractOutputSchema.safeParse(draft).success).toBe(true);
    expect(draft.title).toBe("Board Game Night + Free Dumplings");
    expect(draft.start).toBe(story.start);
    expect(draft.evidence.start?.from).toBe("caption");
  });

  it("give a live read of the story's caption the story's title, and leave other posts alone", () => {
    const caption = storyCaption(now);
    const read = { title: "Board Game Night", evidence: { title: { quote: "Board Game Night", from: "image" as const } } };
    expect(withStoryTitle(read, caption)).toEqual({ title: STORY.title, evidence: { title: { quote: STORY.title, from: "caption" } } });
    expect(withStoryTitle({ ...read, title: "Museum tour" }, caption).title).toBe("Museum tour");
    expect(withStoryTitle(read, "Free pho night! Lobdell Dining Hall").title).toBe("Board Game Night");
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
    const walk = storyCrawlFixture(generic, [story], { from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 0 }, note: `${REPLAN_LINE} (${STORY.title} at MIT Museum)` });
    expect(CrawlPickSchema.safeParse(walk).success).toBe(true);
    expect(walk?.invite).toEqual({ eventId: story.id, message: storyInviteMessage() });
    expect(walk?.stops.some((stop) => stop.eventId === story.id)).toBe(true);
  });
});
