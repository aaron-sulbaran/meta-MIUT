import { describe, expect, it } from "vitest";
import { entersAtLastStep } from "./deck-entry";

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
