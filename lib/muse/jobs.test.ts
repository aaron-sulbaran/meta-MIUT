import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import { ASK_STRUCTURED_OUTPUT, askAboutEvents } from "@/lib/muse/ask";
import { readMuseConfig } from "@/lib/muse/client";
import {
  EXTRACT_STRUCTURED_OUTPUT,
  SPOKEN_NOW_CONFIDENCE,
  UNGROUNDED_CONFIDENCE_CAP,
  buildExtractRequest,
  FREE_BY_DEFAULT_CONFIDENCE,
  NOT_AN_EVENT,
  extractEventDraft,
  extractEventDrafts,
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

describe("extractEventDraft against a stubbed Muse", () => {
  beforeEach(() => {
    vi.stubEnv("MUSE_API_KEY", "test-key-not-real");
    vi.stubEnv("MUSE_BASE_URL", "");
    vi.stubEnv("MUSE_MODEL", "");
    vi.stubEnv("MUSE_REASONING_EFFORT", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const reply = (content: string) =>
    Response.json({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });

  it("retries once when the first draft misses the schema", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply('{"title":"half a draft"}'))
      .mockResolvedValueOnce(reply(JSON.stringify({ events: [extractFixture(now)] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractEventDraft({ caption: SAMPLE_FLYER_CAPTION }, now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("muse");
    expect(result.data?.evidence.place?.from).toBe("caption");
  });

  it("returns one draft per event on a multi-event flyer", async () => {
    const second = { ...extractFixture(now), title: "Pho night, part two" };
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify({ events: [extractFixture(now), second] }))));
    const result = await extractEventDrafts({ caption: SAMPLE_FLYER_CAPTION }, now);
    expect(result.source).toBe("muse");
    expect(result.data?.events.map((event) => event.title)).toEqual(["Free pho night", "Pho night, part two"]);
  });

  it("reports a post that is not an event instead of making one up", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply('{"events":[]}')));
    const all = await extractEventDrafts({ caption: "Pepero Day care packages, $5, delivered 11/11" }, now);
    expect(all.data?.events).toEqual([]);
    const one = await extractEventDraft({ caption: "Pepero Day care packages, $5, delivered 11/11" }, now);
    expect(one).toMatchObject({ data: null, error: NOT_AN_EVENT, source: "muse" });
  });

  it("a spoken line with no time starts now and ends an hour later, flagged", async () => {
    const said = "I'm at the Union with leftover pizza, come grab some";
    const draft = {
      ...extractFixture(now),
      evidence: {
        ...extractFixture(now).evidence,
        title: { quote: "leftover pizza", from: "caption" as const },
        start: { quote: "", from: "inferred" as const },
        end: { quote: "", from: "inferred" as const },
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify({ events: [draft] }))));
    const result = await extractEventDraft({ caption: said, spoken: true }, now);
    expect(result.source).toBe("muse");
    expect(result.data?.start).toBe(now.toISOString());
    expect(result.data?.end).toBe("2026-11-12T17:00:00.000Z");
    expect(result.data?.confidence.start).toBe(SPOKEN_NOW_CONFIDENCE);
    expect(result.data?.confidence.end).toBeLessThanOrEqual(UNGROUNDED_CONFIDENCE_CAP);
  });

  it("a spoken line keeps the time the organizer said", async () => {
    const said = "Free pho night! tomorrow 6 to 8pm at the Texas Union Ballroom";
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify({ events: [extractFixture(now)] }))));
    const result = await extractEventDraft({ caption: said, spoken: true }, now);
    expect(result.data?.start).toBe(extractFixture(now).start);
    expect(result.data?.end).toBe(extractFixture(now).end);
  });

  it("a spoken end that is already past falls back to an hour from the start, flagged", async () => {
    const said = "Leftover bubble tea at Baker House, we're here until 5";
    const draft = {
      ...extractFixture(now),
      end: "2026-11-12T09:00:00-06:00",
      evidence: {
        ...extractFixture(now).evidence,
        start: { quote: "", from: "inferred" as const },
        end: { quote: "until 5", from: "caption" as const },
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify({ events: [draft] }))));
    const result = await extractEventDraft({ caption: said, spoken: true }, now);
    expect(result.data?.end).toBe("2026-11-12T17:00:00.000Z");
    expect(result.data?.confidence.end).toBeLessThanOrEqual(UNGROUNDED_CONFIDENCE_CAP);
  });

  it("does not retry a failed call", async () => {
    const fetchMock = vi.fn(async () => new Response("Too many", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractEventDraft({ caption: SAMPLE_FLYER_CAPTION }, now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("fixture");
  });
});

describe("groundDraft", () => {
  it("treats free with no cost mentioned as the confident default, not a guess", () => {
    const draft = { ...extractFixture(now), free: true, confidence: { ...extractFixture(now).confidence, free: 0.3 } };
    draft.evidence = { ...draft.evidence, free: { quote: "", from: "inferred" } };
    const grounded = groundDraft(draft, SAMPLE_FLYER_CAPTION);
    expect(grounded.confidence.free).toBe(FREE_BY_DEFAULT_CONFIDENCE);
    expect(grounded.evidence.free).toEqual({ quote: "", from: "inferred" });
  });

  it("still caps a not-free answer with no cost quoted", () => {
    const draft = { ...extractFixture(now), free: false };
    draft.evidence = { ...draft.evidence, free: { quote: "", from: "inferred" } };
    expect(groundDraft(draft, SAMPLE_FLYER_CAPTION).confidence.free).toBe(UNGROUNDED_CONFIDENCE_CAP);
  });

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
        expect.stringMatching(/\.foodNote is not required$/),
        expect.stringMatching(/\.properties\.confidence allows additional properties$/),
        expect.stringMatching(/\.properties\.evidence allows additional properties$/),
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

  it("a spoken request says it is the organizer talking, a post request does not", () => {
    const spoken = buildExtractRequest({ caption: "leftover pizza at the Union", spoken: true }, now);
    expect(spoken.prompt).toContain("Organizer said:");
    expect(spoken.system).toContain("organizer speaking");
    const post = buildExtractRequest({ caption: SAMPLE_FLYER_CAPTION }, now);
    expect(post.prompt).toContain("Caption:");
    expect(post.system).not.toContain("organizer speaking");
  });
});
