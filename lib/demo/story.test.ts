import { describe, expect, it } from "vitest";
import { storyFallbackEvent, storyFlyerFor, withStoryFlyer } from "@/lib/demo/story";
import { flyerUrl, storyTimes } from "@/lib/demo/staged";

const now = new Date("2026-11-13T20:05:00Z");

describe("the story event's flyer", () => {
  it("is the flyer the organizer posted on the run's clock", () => {
    expect(storyFlyerFor(storyTimes(now).start)).toBe(flyerUrl(now));
  });

  it("is added once to a story event without an image, and left alone after", () => {
    const fallback = storyFallbackEvent([], now);
    expect(fallback.source.imagePath).toBe(flyerUrl(now));
    const bare = { ...fallback, source: { kind: "instagram" as const, caption: "posted" } };
    const fixed = withStoryFlyer(bare);
    expect(fixed?.source.imagePath).toBe(flyerUrl(now));
    expect(fixed?.source.caption).toBe("posted");
    expect(withStoryFlyer(fixed!)).toBeNull();
  });
});
