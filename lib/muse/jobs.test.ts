import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { askAboutEvents } from "@/lib/muse/ask";
import { readMuseConfig } from "@/lib/muse/client";
import { extractEventDraft } from "@/lib/muse/extract";
import { SAMPLE_FLYER_CAPTION } from "@/lib/muse/fixtures/extract";
import { extractJsonObject } from "@/lib/muse/job";
import { rankEvents } from "@/lib/muse/rank";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);

describe("Muse jobs without a key fall back to fixtures", () => {
  beforeEach(() => {
    vi.stubEnv("MUSE_API_KEY", "");
    vi.stubEnv("MUSE_BASE_URL", "");
    vi.stubEnv("MUSE_MODEL", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reports that Muse is not configured", () => {
    expect(readMuseConfig().error).toContain("not configured");
  });

  it("extract returns the fixture draft", async () => {
    const result = await extractEventDraft({ caption: SAMPLE_FLYER_CAPTION }, now);
    expect(result.source).toBe("fixture");
    expect(result.error).toBeNull();
    expect(result.data?.free).toBe(true);
    expect(result.fallbackReason).toContain("not configured");
    expect(result.data?.start).toBe("2026-11-14T00:00:00.000Z");
  });

  it("rank returns three picks with computed walk minutes", async () => {
    const result = await rankEvents(loadSeedStudent(), events, now);
    expect(result.source).toBe("fixture");
    expect(result.data).toHaveLength(3);
    expect(result.data?.every((pick) => pick.walkMinutes > 0)).toBe(true);
  });

  it("ask returns known event ids only", async () => {
    const result = await askAboutEvents({ question: "rock climbing" }, events, now);
    expect(result.source).toBe("fixture");
    const ids = new Set(events.map((event) => event.id));
    expect(result.data?.eventIds.every((id) => ids.has(id))).toBe(true);
  });
});

describe("extractJsonObject", () => {
  it("pulls JSON out of fenced model output", () => {
    expect(extractJsonObject('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject("no json here")).toBeNull();
  });
});
