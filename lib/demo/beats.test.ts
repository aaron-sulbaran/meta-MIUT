import { describe, expect, it } from "vitest";
import { BEATS } from "@/lib/demo/beats";
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
      const pathname = candidate.path!(context).split("?")[0]!;
      expect(isStagedScreen(pathname), candidate.id).toBe(true);
    }
  });

  it("opens the Live Activity on the run's clock and hands off to the walk home on the same clock", () => {
    const iso = context.now.toISOString();
    expect(beat("U1a").path!(context)).toBe(`${LIVE_ACTIVITY_PATH}?time=${encodeURIComponent(iso)}`);
    expect(beat("U1b").path!(context)).toBe(HANDOFF.walkHome(iso));
  });

  it("lands each handoff on the next beat's exact path, so the phone does not reload", () => {
    expect(beat("O3").path!(context)).toBe(HANDOFF.organizer);
    expect(beat("U2b").path!(context)).toBe(HANDOFF.lisaLanding("evt-story", "sample-student"));
    expect(beat("U3b").path!(context)).toBe(HANDOFF.curate);
  });
});
