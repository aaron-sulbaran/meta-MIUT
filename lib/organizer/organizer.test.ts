import { describe, expect, it } from "vitest";
import { fromCampusWallTime, toCampusWallTime } from "@/lib/organizer/campus-time";
import { tidyFoodNote } from "@/lib/organizer/food-note";
import { campusCenter, knownPlacesFrom, resolvePlace } from "@/lib/organizer/place";

describe("campus wall time", () => {
  it("shows an instant as campus clock time in any device time zone", () => {
    expect(toCampusWallTime("2026-11-13T00:30:00.000Z", "America/New_York")).toBe("2026-11-12T19:30");
    expect(toCampusWallTime("2026-11-13T00:30:00.000Z", "America/Chicago")).toBe("2026-11-12T18:30");
    expect(toCampusWallTime("not a date", "America/New_York")).toBe("");
  });

  it("turns campus clock time back into an instant with the campus offset", () => {
    expect(fromCampusWallTime("2026-11-12T19:30", "America/New_York")).toBe("2026-11-12T19:30:00-05:00");
    expect(fromCampusWallTime("2026-07-04T21:00", "America/New_York")).toBe("2026-07-04T21:00:00-04:00");
    expect(fromCampusWallTime("2026-11-12T19:30", "America/Chicago")).toBe("2026-11-12T19:30:00-06:00");
    expect(fromCampusWallTime("tomorrow at 7", "America/New_York")).toBeNull();
  });

  it("round trips", () => {
    const iso = fromCampusWallTime("2026-11-13T08:05", "America/New_York");
    expect(iso).not.toBeNull();
    expect(toCampusWallTime(iso ?? "", "America/New_York")).toBe("2026-11-13T08:05");
    expect(Date.parse(iso ?? "")).toBe(Date.parse("2026-11-13T13:05:00.000Z"));
  });
});

const places = knownPlacesFrom([
  { place: { name: "Stata Center (32-123)", lat: 42.3616, lng: -71.0906 } },
  { place: { name: "Student Center, W20", lat: 42.3591, lng: -71.0947 } },
  { place: { name: "Kresge Auditorium", lat: 42.3582, lng: -71.0948 } },
  { place: { name: "kresge auditorium", lat: 1, lng: 1 } },
]);

describe("resolvePlace", () => {
  it("keeps one entry per place, first spelling wins", () => {
    expect(places.map((place) => place.name)).toEqual(["Kresge Auditorium", "Stata Center (32-123)", "Student Center, W20"]);
  });

  it("matches the same name exactly and keeps the organizer's wording", () => {
    expect(resolvePlace("KRESGE AUDITORIUM", places)).toEqual({
      place: { name: "KRESGE AUDITORIUM", lat: 42.3582, lng: -71.0948 },
      exact: true,
      knownName: "Kresge Auditorium",
    });
  });

  it("matches on the words that name the building", () => {
    expect(resolvePlace("Room 32-123, Stata", places)?.place.lat).toBe(42.3616);
    expect(resolvePlace("W20 lobby", places)?.place.lng).toBe(-71.0947);
    expect(resolvePlace("Kresge", places)?.exact).toBe(false);
    expect(resolvePlace("W20 lobby", places)?.knownName).toBe("Student Center, W20");
  });

  it("returns null when nothing on the map is that place", () => {
    expect(resolvePlace("Harvard Square", places)).toBeNull();
    expect(resolvePlace("The Lobby", places)).toBeNull();
    expect(resolvePlace("", places)).toBeNull();
  });

  it("finds the middle of campus", () => {
    const center = campusCenter(places);
    expect(center?.lat).toBeCloseTo((42.3616 + 42.3591 + 42.3582) / 3, 6);
    expect(campusCenter([])).toBeNull();
  });
});

describe("tidyFoodNote", () => {
  it("drops a leading free and calms all caps", () => {
    expect(tidyFoodNote("FREE PIZZA")).toBe("Pizza");
    expect(tidyFoodNote("free Insomnia cookies")).toBe("Insomnia cookies");
    expect(tidyFoodNote("Pho, first 80 bowls")).toBe("Pho, first 80 bowls");
    expect(tidyFoodNote("Free")).toBe("Free");
    expect(tidyFoodNote(undefined)).toBe("");
  });
});
