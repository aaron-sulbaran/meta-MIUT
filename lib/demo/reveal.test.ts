import { describe, expect, it } from "vitest";
import { REVEAL_CEILING_MS, shouldReveal, type RevealSignals } from "@/lib/demo/reveal";

const waiting: RevealSignals = { domReady: false, loaded: false, screenReady: false, elapsedMs: 0, held: false };

describe("shouldReveal", () => {
  it("keeps the old screen up while the new one is still parsing", () => {
    expect(shouldReveal(waiting)).toBe(false);
    expect(shouldReveal({ ...waiting, elapsedMs: REVEAL_CEILING_MS - 1 })).toBe(false);
  });

  it("shows an ordinary screen once it is parsed, without waiting for its images", () => {
    expect(shouldReveal({ ...waiting, domReady: true, elapsedMs: 300 })).toBe(true);
  });

  it("shows a screen when its load event fires or it says it is ready", () => {
    expect(shouldReveal({ ...waiting, loaded: true })).toBe(true);
    expect(shouldReveal({ ...waiting, screenReady: true })).toBe(true);
  });

  it("never waits past the ceiling, even with a hung image or a page still streaming", () => {
    expect(shouldReveal({ ...waiting, elapsedMs: REVEAL_CEILING_MS })).toBe(true);
    expect(shouldReveal({ ...waiting, held: true, elapsedMs: REVEAL_CEILING_MS + 500 })).toBe(true);
  });

  it("holds a screen loaded ahead until it loaded or said it is ready, so its reveal is heard", () => {
    expect(shouldReveal({ ...waiting, held: true, domReady: true, elapsedMs: 500 })).toBe(false);
    expect(shouldReveal({ ...waiting, held: true, domReady: true, loaded: true })).toBe(true);
    expect(shouldReveal({ ...waiting, held: true, screenReady: true })).toBe(true);
  });

  it("takes a ceiling of its own", () => {
    expect(shouldReveal({ ...waiting, elapsedMs: 1_000 }, 800)).toBe(true);
  });
});
