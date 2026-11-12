import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { ASK_STRUCTURED_OUTPUT, askAboutEvents } from "@/lib/muse/ask";
import { readMuseConfig } from "@/lib/muse/client";
import {
  EXTRACT_STRUCTURED_OUTPUT,
  UNGROUNDED_CONFIDENCE_CAP,
  buildExtractRequest,
  extractEventDraft,
  groundDraft,
} from "@/lib/muse/extract";
import { SAMPLE_FLYER_CAPTION, extractFixture } from "@/lib/muse/fixtures/extract";
import { extractJsonObject } from "@/lib/muse/job";
import { RANK_STRUCTURED_OUTPUT, rankEvents } from "@/lib/muse/rank";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);

describe("Muse jobs without a key fall back to fixtures", () => {
  beforeEach(() => {
    vi.stubEnv("MUSE_API_KEY", "");
    vi.stubEnv("MUSE_BASE_URL", "");
    vi.stubEnv("MUSE_MODEL", "");
    vi.stubEnv("MUSE_REASONING_EFFORT", "");
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

describe("groundDraft", () => {
  it("keeps caption quotes that are in the caption", () => {
    const draft = extractFixture(now);
    expect(groundDraft(draft, SAMPLE_FLYER_CAPTION)).toEqual(draft);
  });

  it("downgrades made-up caption quotes and caps their confidence", () => {
    const draft = extractFixture(now);
    draft.evidence.place = { quote: "Gregory Gym", from: "caption" };
    delete draft.evidence.access;
    const grounded = groundDraft(draft, SAMPLE_FLYER_CAPTION);
    expect(grounded.evidence.place).toEqual({ quote: "Gregory Gym", from: "inferred" });
    expect(grounded.confidence.place).toBe(UNGROUNDED_CONFIDENCE_CAP);
    expect(grounded.evidence.access).toEqual({ quote: "", from: "inferred" });
    expect(grounded.confidence.access).toBe(UNGROUNDED_CONFIDENCE_CAP);
    expect(grounded.confidence.title).toBe(draft.confidence.title);
  });

  it("trusts image quotes and ignores case and spacing in caption quotes", () => {
    const draft = extractFixture(now);
    draft.evidence.place = { quote: "Union Ballroom, 2nd floor", from: "image" };
    draft.evidence.title = { quote: "FREE  PHO night!", from: "caption" };
    const grounded = groundDraft(draft, SAMPLE_FLYER_CAPTION);
    expect(grounded.evidence.place?.from).toBe("image");
    expect(grounded.evidence.title?.from).toBe("caption");
    expect(grounded.confidence.place).toBe(draft.confidence.place);
  });
});

describe("extractJsonObject", () => {
  it("pulls JSON out of fenced model output", () => {
    expect(extractJsonObject('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

// The documented rules strict mode adds on top of a constrained schema.
function strictModeViolations(schema: unknown, path = "$"): string[] {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => strictModeViolations(item, `${path}[${index}]`));
  if (typeof schema !== "object" || schema === null) return [];
  const node = schema as Record<string, unknown>;
  const violations: string[] = [];
  if ("allOf" in node || "oneOf" in node) violations.push(`${path} uses allOf or oneOf`);
  if (node.type === "object") {
    if (node.additionalProperties !== false) violations.push(`${path} allows additional properties`);
    const keys = Object.keys((node.properties as Record<string, unknown> | undefined) ?? {});
    const required = new Set((node.required as string[] | undefined) ?? []);
    for (const key of keys) if (!required.has(key)) violations.push(`${path}.${key} is not required`);
  }
  for (const [key, value] of Object.entries(node)) violations.push(...strictModeViolations(value, `${path}.${key}`));
  return violations;
}

describe("job output schemas as JSON schema", () => {
  const outputs = [EXTRACT_STRUCTURED_OUTPUT, RANK_STRUCTURED_OUTPUT, ASK_STRUCTURED_OUTPUT];

  it("each job produces a named object schema without $schema", () => {
    for (const output of outputs) {
      expect(output.name).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(output.schema.type).toBe("object");
      expect(output.schema).not.toHaveProperty("$schema");
    }
  });

  it("extract breaks the strict rules, so every job is sent with strict off", () => {
    expect(strictModeViolations(EXTRACT_STRUCTURED_OUTPUT.schema)).toEqual(
      expect.arrayContaining([
        "$.foodNote is not required",
        "$.properties.confidence allows additional properties",
        "$.properties.evidence allows additional properties",
      ]),
    );
    expect(strictModeViolations(RANK_STRUCTURED_OUTPUT.schema)).toEqual([]);
    expect(strictModeViolations(ASK_STRUCTURED_OUTPUT.schema)).toEqual([]);
  });

  it("the extract request carries the schema and the image", () => {
    const request = buildExtractRequest(
      { caption: SAMPLE_FLYER_CAPTION, imageBase64: "QUJD", imageMediaType: "image/png" },
      now,
    );
    expect(request.structuredOutput).toBe(EXTRACT_STRUCTURED_OUTPUT);
    expect(request.image).toEqual({ base64: "QUJD", mediaType: "image/png" });
  });
});
