import { describe, expect, it } from "vitest";
import { BEATS, STORY_DUE_AFTER } from "@/lib/demo/beats";
import { inFrameMessage } from "@/lib/demo/beat-context";
import { HANDOFF, LIVE_ACTIVITY_PATH, isStagedScreen } from "@/lib/demo/staged";

const context = { storyEventId: "evt-story", now: new Date("2026-11-13T22:02:00Z") };
const beat = (id: string) => {
  const found = BEATS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No beat ${id}`);
  return found;
};

describe("demo beats", () => {
  it("loads every staged beat from a staged route, where Facebook's chrome stays off", () => {
    const staged = BEATS.filter((candidate) => candidate.kind === "staged");
    expect(staged.length).toBeGreaterThan(0);
    for (const candidate of staged) {
      const pathname = candidate.path!(context)!.split("?")[0]!;
      expect(isStagedScreen(pathname), candidate.id).toBe(true);
    }
  });

  it("opens the Live Activity on the run's clock and hands off to the walk home on the same clock", () => {
    const iso = context.now.toISOString();
    expect(beat("U1a").path!(context)).toBe(`${LIVE_ACTIVITY_PATH}?time=${encodeURIComponent(iso)}`);
    expect(beat("U1b").path!(context)).toBe(HANDOFF.walkHome(iso));
  });

  it("lands each handoff on the next beat's exact path, so the phone does not reload", () => {
    const iso = context.now.toISOString();
    expect(beat("O1").path!(context)).toBe(HANDOFF.instagramPost(iso));
    expect(beat("O2").path!(context)).toBe(HANDOFF.instagramPost(iso));
    expect(beat("O3").path!(context)).toBe(HANDOFF.organizerAt(iso));
    expect(HANDOFF.organizerAt(iso)).toBe(`/organizer?handoff=story&at=${encodeURIComponent(iso)}`);
    expect(HANDOFF.instagramPost(null)).toBe("/demo/instagram/post");
    expect(beat("U2b").path!(context)).toBe(HANDOFF.lisaLanding("evt-story", "sample-student"));
    expect(beat("U3b").path!(context)).toBe(HANDOFF.firstEvents);
    expect(HANDOFF.firstEvents).toBe("/?first=1&opened=instagram");
    // Trish's onboarding moves in place: each beat continues the one before it inside the frame.
    expect(beat("U3b2").inFrame).toEqual({ from: "U3b", message: { type: "demo-first", step: "ask" } });
    expect(beat("U3b3").inFrame).toEqual({ from: "U3b2", message: { type: "demo-first", step: "read" } });
    expect(beat("U3c").inFrame).toEqual({ from: "U3b3", message: { type: "demo-first", step: "list" } });
    expect(beat("U3b2").path!(context)).toBe(HANDOFF.firstEventsAsk);
    expect(beat("U3b3").path!(context)).toBe(HANDOFF.firstEventsRead);
    expect(beat("U3c").path!(context)).toBe(HANDOFF.firstEventsList);
    expect(beat("O5").path!(context)).toBe(HANDOFF.organizerPosted(iso));
    expect(beat("U1c").path!(context)).toBe(HANDOFF.replanLisa(iso));
    expect(beat("U2c").path!(context)).toBe(HANDOFF.lisaStep("evt-story", "sample-student", "account"));
    expect(beat("U2d").path!(context)).toBe(HANDOFF.lisaStep("evt-story", "sample-student", "ready"));
    expect(beat("U2e").path!(context)).toBe(HANDOFF.lisaStep("evt-story", "sample-student", "event"));
    expect(beat("U2f").path!(context)).toBe(HANDOFF.lisaJoined("evt-story", "sample-student"));
    expect(beat("U3d").path!(context)).toBe(HANDOFF.whosGoing("evt-story"));
  });

  it("walks Trish through three reels and the sheet in one screen, each beat moving it in place", () => {
    expect(["U3a1", "U3a2", "U3a3", "U3a4"].map((id) => beat(id).path!(context))).toEqual([
      "/demo/instagram/reels?reel=1",
      "/demo/instagram/reels?reel=2",
      "/demo/instagram/reels?reel=3",
      "/demo/instagram/reels?reel=3&sheet=1",
    ]);
    expect(inFrameMessage(beat("U3a2"), HANDOFF.reels(1), context)).toEqual({ type: "demo-reel", reel: 2 });
    expect(inFrameMessage(beat("U3a3"), HANDOFF.reels(2), context)).toEqual({ type: "demo-reel", reel: 3 });
    expect(inFrameMessage(beat("U3a4"), HANDOFF.reels(3), context)).toEqual({ type: "demo-reel", reel: 3, sheet: true });
    expect(inFrameMessage(beat("U3a3"), HANDOFF.reels(1), context)).toBeNull();
  });

  it("closes on the same event page: U3f records Jolyn's and Lisa's yes in place", () => {
    expect(beat("U3f").path!(context)).toBe(HANDOFF.saidYes("evt-story"));
    expect(inFrameMessage(beat("U3f"), HANDOFF.saidHi("evt-story"), context)).toEqual({ type: "demo-say-yes" });
  });

  it("ends Trish's act on the same event page: U3e says hi in place", () => {
    expect(beat("U3e").path!(context)).toBe(HANDOFF.saidHi("evt-story"));
    expect(inFrameMessage(beat("U3e"), HANDOFF.whosGoing("evt-story"), context)).toEqual({ type: "demo-say-hi" });
  });

  it("never needs the story event before the organizer has published it", () => {
    expect(BEATS[STORY_DUE_AFTER]!.id).toBe("O5");
    for (const candidate of BEATS.slice(0, STORY_DUE_AFTER + 1)) {
      if (candidate.path) expect(candidate.path({ storyEventId: null, now: context.now }), candidate.id).not.toBeNull();
    }
    expect(beat("U2b").path!({ storyEventId: null, now: context.now })).toBeNull();
  });
});
