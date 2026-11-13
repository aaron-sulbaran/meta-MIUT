import { describe, expect, it } from "vitest";
import { entersAtLastStep, followsAsBeatMove, undoesRemoteMove } from "./deck-entry";

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

describe("undoesRemoteMove", () => {
  it("lets only the presenting stage put the record back", () => {
    expect(undoesRemoteMove("tab-a", "tab-a")).toBe(true);
    expect(undoesRemoteMove("tab-a", "tab-b")).toBe(false);
  });

  it("lets any stage do it before a stage has moved the show", () => {
    expect(undoesRemoteMove(undefined, "tab-b")).toBe(true);
    expect(undoesRemoteMove(null, "tab-b")).toBe(true);
  });
});
