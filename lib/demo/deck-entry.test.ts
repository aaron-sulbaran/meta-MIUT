import { describe, expect, it } from "vitest";
import { catchesUpOnRemoteStep, entersAtLastStep, followsAsBeatMove } from "./deck-entry";

describe("entersAtLastStep", () => {
  it("enters at the last step on a single Back", () => {
    expect(entersAtLastStep(1, 0)).toBe(true);
    expect(entersAtLastStep(7, 6)).toBe(true);
  });

  it("starts at the first step going forward or staying put", () => {
    expect(entersAtLastStep(0, 1)).toBe(false);
    expect(entersAtLastStep(0, 0)).toBe(false);
  });

  it("starts at the first step on a jump back of more than one beat", () => {
    expect(entersAtLastStep(25, 0)).toBe(false);
    expect(entersAtLastStep(9, 3)).toBe(false);
  });

  it("starts at the first step on a fresh run, even from the next beat", () => {
    expect(entersAtLastStep(1, 0, true)).toBe(false);
    expect(entersAtLastStep(25, 0, true)).toBe(false);
    expect(entersAtLastStep(0, 0, true)).toBe(false);
  });
});

describe("followsAsBeatMove", () => {
  it("applies another stage's move as a beat move", () => {
    expect(followsAsBeatMove("stage")).toBe(true);
  });

  it("lets the remote and the phones step a deck first", () => {
    expect(followsAsBeatMove("control")).toBe(false);
    expect(followsAsBeatMove(undefined)).toBe(false);
  });
});

describe("catchesUpOnRemoteStep", () => {
  const control = { seq: 50, from: 0, to: 1 };
  it("steps for a remote Next or Back another stage already put back", () => {
    expect(catchesUpOnRemoteStep(control, 40, 0)).toBe(true);
    expect(catchesUpOnRemoteStep({ seq: 50, from: 3, to: 2 }, 40, 3)).toBe(true);
  });

  it("never applies the same move twice, a move from another beat, or a jump", () => {
    expect(catchesUpOnRemoteStep(control, 50, 0)).toBe(false);
    expect(catchesUpOnRemoteStep(control, 40, 5)).toBe(false);
    expect(catchesUpOnRemoteStep({ seq: 50, from: 0, to: 4 }, 40, 0)).toBe(false);
    expect(catchesUpOnRemoteStep(undefined, 40, 0)).toBe(false);
  });
});
