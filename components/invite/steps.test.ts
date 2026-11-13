import { describe, expect, it } from "vitest";
import { inviteStep } from "@/components/invite/steps";

describe("the invite landing's steps", () => {
  it("opens on the step ?state= names, and on the locked preview otherwise", () => {
    expect(inviteStep("account")).toBe("account");
    expect(inviteStep("joined")).toBe("joined");
    expect(inviteStep(undefined)).toBe("locked");
    expect(inviteStep("posted")).toBe("locked");
  });
});
