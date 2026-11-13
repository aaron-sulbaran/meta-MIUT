import { describe, expect, it } from "vitest";
import { pickPlace } from "@/lib/map/pick-place";

const home = { lat: 42.3616, lng: -71.0906 };

describe("pickPlace", () => {
  it("takes the notable place over a closer street with the same name", () => {
    const best = pickPlace(
      [
        { name: "Harvard Square", lat: 42.37347, lng: -71.11894, importance: 0.39 },
        { name: "Harvard Square", lat: 42.37302, lng: -71.06272, importance: 0.05 },
        { name: "Harvard Square", lat: 42.37262, lng: -71.06302, importance: 0.04 },
      ],
      home,
    );
    expect(best?.hit.lng).toBeCloseTo(-71.11894, 4);
  });

  it("takes the closest of equally notable hits", () => {
    const best = pickPlace(
      [
        { name: "Temazcal Tacos", lat: 42.36067, lng: -71.01844, importance: 0.0001 },
        { name: "Mexcito Street Tacos", lat: 42.36337, lng: -71.082, importance: 0.0001 },
      ],
      home,
    );
    expect(best?.hit.name).toBe("Mexcito Street Tacos");
  });

  it("takes the closest when no hit has an importance", () => {
    const best = pickPlace(
      [
        { name: "Far", lat: 42.4, lng: -71.0, importance: 0 },
        { name: "Near", lat: 42.362, lng: -71.09, importance: 0 },
      ],
      home,
    );
    expect(best?.hit.name).toBe("Near");
  });

  it("returns null for no hits", () => {
    expect(pickPlace([], home)).toBeNull();
  });
});
