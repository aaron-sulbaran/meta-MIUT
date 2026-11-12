import { describe, expect, it } from "vitest";
import { initials } from "@/components/map/category-icons";

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
