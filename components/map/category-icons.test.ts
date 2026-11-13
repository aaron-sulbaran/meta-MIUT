import { describe, expect, it } from "vitest";
import { initials, monogram } from "@/components/map/category-icons";

describe("initials", () => {
  it("takes the first letters of the first two real words", () => {
    expect(initials("Intro to bouldering night")).toBe("IB");
    expect(initials("ACM general meeting and pizza")).toBe("AG");
    expect(initials("The Student film screening")).toBe("SF");
  });

  it("handles punctuation, one word, and nothing", () => {
    expect(initials("Build night: hardware hack")).toBe("BN");
    expect(initials("hackathon")).toBe("H");
    expect(initials("!!!")).toBe("?");
  });
});

describe("monogram", () => {
  it("keeps a short all-caps first word, else uses initials", () => {
    expect(monogram("HSA at MIT")).toBe("HSA");
    expect(monogram("MIT Sloan Women in Management")).toBe("MIT");
    expect(monogram("Sample CS Club")).toBe("SC");
    expect(monogram("Lu's Cafe")).toBe("LC");
    expect(monogram("Toastmasters")).toBe("T");
  });
});
