import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { draftOpenPrompt } from "@/lib/muse/open-prompt";

const event: CampusEvent = {
  id: "evt-boulder-limited",
  title: "Fall Boulder Social",
  description: "All levels welcome.",
  start: "2026-11-12T19:00:00.000Z",
  end: "2026-11-12T20:30:00.000Z",
  place: { name: "Climbing wall", lat: 30.2843, lng: -97.7365 },
  free: true,
  food: true,
  foodNote: "Pizza, vegetarian options",
  access: { kind: "rsvp", capacity: 40 },
  organizer: { name: "Sample Climbing Club", handle: "sample_climbing" },
  source: { kind: "manual" },
  status: "published",
  createdAt: "2026-11-10T12:00:00.000Z",
};

const reply = (content: string) =>
  Response.json({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });

describe("draftOpenPrompt", () => {
  beforeEach(() => {
    vi.stubEnv("MUSE_API_KEY", "");
    vi.stubEnv("MUSE_BASE_URL", "");
    vi.stubEnv("MUSE_MODEL", "");
    vi.stubEnv("MUSE_REASONING_EFFORT", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("without Muse, asks about the food 30 minutes before the end", async () => {
    const result = await draftOpenPrompt(event);
    expect(result.source).toBe("fixture");
    expect(result.data).toEqual({
      leftover: "food",
      question: "Still have pizza left? Open it to everyone?",
      askAt: "2026-11-12T20:00:00.000Z",
    });
  });

  it("without food, asks about room", async () => {
    const result = await draftOpenPrompt({ ...event, food: false, foodNote: undefined });
    expect(result.data?.leftover).toBe("seats");
  });

  it("uses Muse's wording when it answers", async () => {
    vi.stubEnv("MUSE_API_KEY", "test-key-not-real");
    vi.stubGlobal("fetch", vi.fn(async () => reply('{"leftover":"merch","question":"Still have T-shirts? Open it to everyone?"}')));
    const result = await draftOpenPrompt({ ...event, food: false });
    expect(result.source).toBe("muse");
    expect(result.data?.leftover).toBe("merch");
    expect(result.data?.askAt).toBe("2026-11-12T20:00:00.000Z");
  });
});
