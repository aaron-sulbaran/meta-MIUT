import { describe, expect, it } from "vitest";
import { BEATS } from "@/lib/demo/beats";
import { APP_CHROME, phoneChromeFor } from "@/lib/demo/phone-chrome";

describe("phoneChromeFor", () => {
  it("lays app beats out below the status bar", () => {
    for (const beat of BEATS.filter((item) => item.kind === "app")) expect(phoneChromeFor(beat)).toEqual(APP_CHROME);
  });

  it("runs the Lock Screen full bleed with light glyphs and no bar clock", () => {
    const chrome = phoneChromeFor({ kind: "staged", staged: "live-activity" });
    expect(chrome).toMatchObject({ layout: "full-bleed", tone: "light", showTime: false });
  });

  it("gives every staged beat a chrome, and its placeholder the app layout", () => {
    for (const beat of BEATS.filter((item) => item.kind === "staged")) {
      expect(phoneChromeFor(beat).layout).toBe("full-bleed");
      expect(phoneChromeFor(beat, true)).toEqual(APP_CHROME);
    }
  });
});
