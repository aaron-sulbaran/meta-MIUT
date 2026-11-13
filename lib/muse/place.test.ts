import { describe, expect, it } from "vitest";
import { placeFixture } from "@/lib/muse/fixtures/place";
import { PlaceReadSchema } from "@/lib/muse/place";

describe("placeFixture", () => {
  it("searches for what the student typed when Muse is away", () => {
    const read = placeFixture("  boston comon ");
    expect(PlaceReadSchema.parse(read)).toEqual({ reachable: true, query: "boston comon", reason: "" });
  });
});
