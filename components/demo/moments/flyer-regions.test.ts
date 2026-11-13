import { describe, expect, it } from "vitest";
import { flyerRegions, locateQuote, readFields, wordOverlap } from "@/components/demo/moments/flyer-regions";
import type { ExtractDraft } from "@/components/organizer/types";

const regions = flyerRegions("2:30 to 4:30 AM");

const draft: ExtractDraft = {
  title: "Board Game Night",
  description: "",
  start: "2026-11-13T02:30:00-05:00",
  end: "2026-11-13T04:30:00-05:00",
  placeName: "MIT Museum, 314 Main St",
  free: true,
  food: true,
  foodNote: "free dumplings while they last",
  access: { kind: "open" },
  confidence: { title: 0.99, start: 0.9, place: 0.99, food: 0.99, access: 0.5 },
  evidence: {
    title: { quote: "Board Game Night", from: "caption" },
    start: { quote: "2:30 to 4:30 AM", from: "caption" },
    place: { quote: "MIT Museum (314 Main St)", from: "caption" },
    food: { quote: "free dumplings while they last", from: "caption" },
    access: { quote: "Open to everyone", from: "caption" },
  },
};

describe("flyer regions", () => {
  it("scores word overlap on the shorter text", () => {
    expect(wordOverlap("free dumplings while they last", "+ Free dumplings")).toBe(1);
    expect(wordOverlap("pho night", "Board game night")).toBe(0.5);
  });

  it("boxes a quote only where its words are printed", () => {
    expect(locateQuote("when", "2:30 to 4:30 AM", regions)?.id).toBe("when");
    expect(locateQuote("title", "Free pho night!", regions)).toBeNull();
    expect(locateQuote("title", "", regions)).toBeNull();
  });

  it("reads the five fields, flags low confidence and inferred ones", () => {
    const fields = readFields(draft, regions, () => "Today");
    expect(fields.map((field) => field.source.kind)).toEqual(["flyer", "flyer", "flyer", "flyer", "flyer"]);
    expect(fields.find((field) => field.id === "access")?.guessed).toBe(true);
    const inferred = readFields({ ...draft, evidence: { ...draft.evidence, title: { quote: "", from: "inferred" } } }, regions, () => "Today");
    expect(inferred[0]?.source.kind).toBe("guess");
    expect(inferred[0]?.guessed).toBe(true);
  });

  it("falls back to the caption when the quote is not on the flyer", () => {
    const fields = readFields({ ...draft, evidence: { ...draft.evidence, title: { quote: "Come by after class", from: "caption" } } }, regions, () => "Today");
    expect(fields[0]?.source.kind).toBe("caption");
  });
});
