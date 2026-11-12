import { describe, expect, it } from "vitest";
import { composeAlert } from "@/lib/alerts/compose";
import type { CampusEvent } from "@/lib/events/schema";

const NOW = new Date("2026-11-12T20:00:00.000Z");
const PLACE = { name: "Gregory Gym Climbing Wall", lat: 30.2843, lng: -97.7365 };
// A reader standing at the venue is a 1 minute walk away (the floor).
const AT_VENUE = { now: NOW, viewerLocation: { lat: PLACE.lat, lng: PLACE.lng } };

const event: CampusEvent = {
  id: "evt-boulder",
  title: "Fall Boulder Social",
  description: "All levels welcome.",
  start: "2026-11-12T20:20:00.000Z",
  end: "2026-11-12T21:50:00.000Z",
  place: PLACE,
  free: true,
  food: true,
  foodNote: "Pizza, vegetarian options",
  access: { kind: "rsvp", capacity: 40 },
  organizer: { name: "Sample Climbing Club", handle: "sample_climbing" },
  source: { kind: "manual" },
  status: "published",
  createdAt: NOW.toISOString(),
};

describe("composeAlert", () => {
  it("names the event and what is free, then where, how far, and when", () => {
    expect(composeAlert(event, "free_food_nearby", AT_VENUE)).toEqual({
      kind: "free_food_nearby",
      eventId: "evt-boulder",
      title: "Free pizza at Fall Boulder Social",
      body: "Gregory Gym Climbing Wall, 1 min walk, starts in 20 min",
    });
  });

  it("counts down while the event is on and for leftovers", () => {
    const midway = { ...AT_VENUE, now: new Date("2026-11-12T21:05:00.000Z") };
    expect(composeAlert(event, "free_food_nearby", midway).body).toBe(
      "Gregory Gym Climbing Wall, 1 min walk, on now, 45 min left",
    );
    expect(composeAlert(event, "leftover_food", midway)).toMatchObject({
      title: "Leftover pizza at Fall Boulder Social",
      body: "Gregory Gym Climbing Wall, 1 min walk, 45 min left",
    });
  });

  it("says who posted a new event and what it offers", () => {
    expect(composeAlert(event, "new_event", AT_VENUE)).toMatchObject({
      title: "Sample Climbing Club posted Fall Boulder Social",
      body: "Free pizza, Gregory Gym Climbing Wall, 1 min walk, starts in 20 min",
    });
  });

  it("describes events without food or without a price honestly", () => {
    const freeEntry = { ...event, food: false, foodNote: undefined };
    expect(composeAlert(freeEntry, "new_event", AT_VENUE).body.startsWith("Free entry, ")).toBe(true);
    const paidWithFood = { ...event, free: false, foodNote: "tacos" };
    expect(composeAlert(paidWithFood, "free_food_nearby", AT_VENUE).title).toBe("Tacos at Fall Boulder Social");
  });

  it("leaves the distance out without a reader location and shows far starts as a clock time", () => {
    const later = { ...event, start: "2026-11-13T01:30:00.000Z", end: "2026-11-13T03:00:00.000Z" };
    expect(composeAlert(later, "new_event", { now: NOW }).body).toBe(
      "Free pizza, Gregory Gym Climbing Wall, starts at 7:30 PM",
    );
  });

  it("keeps the food label short and clips long titles to the alert limit", () => {
    const longNote = { ...event, foodNote: "A whole spread of tacos from the place on Guadalupe" };
    expect(composeAlert(longNote, "free_food_nearby", AT_VENUE).title).toBe("Free food at Fall Boulder Social");
    const longTitle = { ...event, title: "Social ".repeat(25).trim() };
    const title = composeAlert(longTitle, "free_food_nearby", AT_VENUE).title;
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title.endsWith("...")).toBe(true);
  });
});
