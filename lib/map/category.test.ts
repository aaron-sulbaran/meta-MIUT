import { describe, expect, it } from "vitest";
import { eventCategory } from "@/lib/map/category";

const event = (title: string, foodNote?: string, description = "") => ({ title, foodNote, description });

describe("eventCategory", () => {
  it("reads the title first", () => {
    expect(eventCategory(event("ACM general meeting and pizza", "Pizza, vegetarian options"))).toBe("pizza");
    expect(eventCategory(event("Intro to bouldering night"))).toBe("climb");
    expect(eventCategory(event("Student film screening"))).toBe("film");
    expect(eventCategory(event("Student orchestra fall concert"))).toBe("music");
    expect(eventCategory(event("Build night: hardware hack", "Dinner provided"))).toBe("code");
    expect(eventCategory(event("Resume review and boba", "Boba"))).toBe("boba");
  });

  it("falls back to the food note, then to a plain event", () => {
    expect(eventCategory(event("Club social", "Breakfast tacos"))).toBe("taco");
    expect(eventCategory(event("Club social", "Snacks"))).toBe("meal");
    expect(eventCategory(event("Club social"))).toBe("event");
  });
});
