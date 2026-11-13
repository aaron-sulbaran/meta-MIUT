import { describe, expect, it } from "vitest";
import { placeNamedIn } from "@/lib/muse/crawl-places";

describe("placeNamedIn", () => {
  it("finds a campus spot named by name or alias", () => {
    expect(placeNamedIn("food crawl on my way to Kendall")?.name).toBe("Kendall Square");
    expect(placeNamedIn("snacks before Harvard Square")?.name).toBe("Harvard Square");
  });

  it("matches whole words only", () => {
    expect(placeNamedIn("free food near HackHarvard")).toBeNull();
    expect(placeNamedIn("i want a food crawl")).toBeNull();
  });
});
