import { describe, expect, it } from "vitest";
import { HANDOFF, isStagedScreen, storyCaption, storyTimeLine, storyTimes } from "@/lib/demo/staged";

// Tests run on the frozen test campus (tests/fixtures/brand.ts, America/Chicago).
const NOW = new Date("2026-11-13T22:02:00Z"); // 4:02 PM campus time

describe("staged screens", () => {
  it("knows which paths imitate another app", () => {
    expect(isStagedScreen("/demo/instagram/post")).toBe(true);
    expect(isStagedScreen("/demo/instagram")).toBe(true);
    expect(isStagedScreen("/demo/console")).toBe(false);
    expect(isStagedScreen("/demo/instagramish")).toBe(false);
    expect(isStagedScreen(null)).toBe(false);
  });

  it("starts the story about 25 minutes out, on the next 5 minutes, for two hours", () => {
    const { start, end } = storyTimes(NOW);
    expect(start.toISOString()).toBe("2026-11-13T22:30:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(120 * 60_000);
    expect(storyTimeLine(NOW)).toBe("4:30 to 6:30 PM");
  });

  it("puts the same times in the caption the flyer shows", () => {
    expect(storyCaption(NOW)).toContain(storyTimeLine(NOW));
    expect(storyCaption(NOW)).toContain("MIT Museum");
    expect(storyCaption(NOW)).toContain("Board Game Night");
  });

  it("hands off to one place per beat", () => {
    expect(HANDOFF.organizer).toBe("/organizer?handoff=story");
    expect(HANDOFF.lisaLanding("evt-1", "sample-student")).toBe("/events/evt-1?invite=sample-student");
  });
});
