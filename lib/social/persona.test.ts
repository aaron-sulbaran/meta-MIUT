import { describe, expect, it } from "vitest";
import { DEMO_USER_ID } from "@/lib/muse/memory";
import { DEFAULT_VIEWER_ID, parsePersona, personaFromCookieString, viewerIdFor } from "@/lib/social/persona";

describe("demo persona cookie", () => {
  it("reads known personas and treats anything else as the sample student", () => {
    expect(parsePersona("lisa")).toBe("lisa");
    expect(parsePersona("organizer")).toBe("organizer");
    expect(parsePersona("nobody")).toBeNull();
    expect(parsePersona(undefined)).toBeNull();
  });

  it("finds the persona in a cookie string", () => {
    expect(personaFromCookieString("a=1; demo-persona=user3; b=2")).toBe("user3");
    expect(personaFromCookieString("a=1")).toBeNull();
  });

  it("maps no persona to the sample student's viewer id", () => {
    expect(DEFAULT_VIEWER_ID).toBe(DEMO_USER_ID);
    expect(viewerIdFor(null)).toBe(DEMO_USER_ID);
    expect(viewerIdFor("lisa")).toBe("lisa");
  });
});
