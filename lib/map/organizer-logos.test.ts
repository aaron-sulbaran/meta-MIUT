import { describe, expect, it } from "vitest";
import { generatedLogo, logoKindFor } from "@/lib/map/generated-logo";
import { ORGANIZER_LOGOS, organizerLogo } from "@/lib/map/organizer-logos";

describe("organizerLogo", () => {
  it("prefers the logo in the event data", () => {
    expect(organizerLogo({ name: "Thai Students at MIT", handle: "mit_tsmit", logoUrl: "/logos/tsmit.png" })).toBe("/logos/tsmit.png");
  });

  it("falls back to the known logo by handle, ignoring @ and case", () => {
    expect(organizerLogo({ name: "Thai Students at MIT", handle: "@MIT_TSMIT" })).toBe(ORGANIZER_LOGOS.mit_tsmit);
  });

  it("generates a logo for an organizer with none", () => {
    const logo = organizerLogo({ name: "Boston Student Runners", handle: "bostonrunners" });
    expect(logo).toBe(generatedLogo("Boston Student Runners"));
    expect(logo.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("only links https images", () => {
    expect(Object.values(ORGANIZER_LOGOS).every((url) => url.startsWith("https://"))).toBe(true);
  });
});

describe("generatedLogo", () => {
  it("picks an icon for what the group does", () => {
    expect(logoKindFor("Boston Student Runners")).toBe("run");
    expect(logoKindFor("Boston Common Skating")).toBe("skate");
    expect(logoKindFor("Cambridge Coffee Collective")).toBe("coffee");
    expect(logoKindFor("Central Square Film Club")).toBe("film");
    expect(logoKindFor("Kendall Founders")).toBe("idea");
    expect(logoKindFor("HackMIT")).toBe("code");
    expect(logoKindFor("MIT Games Club")).toBe("games");
    expect(logoKindFor("MIT Media Lab")).toBe("lab");
    expect(logoKindFor("MIT Outing Club")).toBe("outdoors");
    expect(logoKindFor("Maseeh Hall")).toBe("home");
    expect(logoKindFor("Harvard Undergraduate Council")).toBe("council");
  });

  it("gives a group with a plain name a sparkle, the same one every time", () => {
    expect(logoKindFor("The Friday Crew")).toBe("sparkle");
    expect(generatedLogo("The Friday Crew")).toBe(generatedLogo("The Friday Crew"));
  });
});
