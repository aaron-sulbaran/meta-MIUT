import { describe, expect, it } from "vitest";
import { ORGANIZER_LOGOS, organizerLogo } from "@/lib/map/organizer-logos";

describe("organizerLogo", () => {
  it("prefers the logo in the event data", () => {
    expect(organizerLogo({ name: "Thai Students at MIT", handle: "mit_tsmit", logoUrl: "/logos/tsmit.png" })).toBe("/logos/tsmit.png");
  });

  it("falls back to the known logo by handle, ignoring @ and case", () => {
    expect(organizerLogo({ name: "Thai Students at MIT", handle: "@MIT_TSMIT" })).toBe(ORGANIZER_LOGOS.mit_tsmit);
  });

  it("returns null for an organizer with no logo, so the bubble shows a monogram", () => {
    expect(organizerLogo({ name: "MIT Museum", handle: "mit_museum" })).toBeNull();
  });

  it("only links https images", () => {
    expect(Object.values(ORGANIZER_LOGOS).every((url) => url.startsWith("https://"))).toBe(true);
  });
});
