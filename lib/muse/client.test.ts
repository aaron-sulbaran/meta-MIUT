import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callMuse, museAdapter, readMuseConfig, type MuseConfig } from "@/lib/muse/client";

const config: MuseConfig = {
  apiKey: "test-key-not-real",
  baseUrl: "https://api.meta.ai/v1",
  model: "muse-spark-1.3",
  reasoningEffort: "low",
};

function sentBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("readMuseConfig", () => {
  it("applies defaults when base URL, model, and effort are unset or empty", () => {
    const result = readMuseConfig({ MUSE_API_KEY: "k", MUSE_BASE_URL: "", MUSE_MODEL: "  " });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      apiKey: "k",
      baseUrl: "https://api.meta.ai/v1",
      model: "muse-ember-1.0",
      reasoningEffort: "low",
    });
  });

  it("trims a trailing slash and keeps explicit values", () => {
    const result = readMuseConfig({
      MUSE_API_KEY: "k",
      MUSE_BASE_URL: "https://example.test/v1/",
      MUSE_MODEL: "muse-ember-1.0",
      MUSE_REASONING_EFFORT: "minimal",
    });
    expect(result.data?.baseUrl).toBe("https://example.test/v1");
    expect(result.data?.model).toBe("muse-ember-1.0");
    expect(result.data?.reasoningEffort).toBe("minimal");
  });

  it("requires the key and rejects an unknown effort", () => {
    expect(readMuseConfig({}).error).toContain("MUSE_API_KEY");
    expect(readMuseConfig({ MUSE_API_KEY: "k", MUSE_REASONING_EFFORT: "none" }).error).toContain(
      "MUSE_REASONING_EFFORT",
    );
  });
});

describe("museAdapter.buildRequest", () => {
  it("builds the chat completions call with developer role, image part, and effort", () => {
    const { url, init } = museAdapter.buildRequest(config, {
      system: "Read flyers.",
      prompt: "Caption here",
      image: { base64: "QUJD", mediaType: "image/jpeg" },
    });
    expect(url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json", authorization: "Bearer test-key-not-real" });

    const body = sentBody(init);
    expect(body.model).toBe("muse-spark-1.3");
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages).toEqual([
      { role: "developer", content: "Read flyers." },
      {
        role: "user",
        content: [
          { type: "text", text: "Caption here" },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
        ],
      },
    ]);
    for (const rejected of ["response_format", "max_completion_tokens", "temperature", "stop", "n", "max_output_tokens"]) {
      expect(body).not.toHaveProperty(rejected);
    }
  });

  it("sends response_format and max_completion_tokens when asked", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    const { init } = museAdapter.buildRequest(config, {
      system: "s",
      prompt: "p",
      structuredOutput: { name: "thing", schema },
      maxCompletionTokens: 800,
    });
    const body = sentBody(init);
    expect(body.max_completion_tokens).toBe(800);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "thing", strict: false, schema },
    });
  });
});

describe("museAdapter readers", () => {
  it("reads content, usage, and finish reason", () => {
    expect(
      museAdapter.readResponse({
        id: "x",
        object: "chat.completion",
        created: 1,
        model: "muse-spark-1.3",
        choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    ).toEqual({ text: "{}", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, finishReason: "stop" });
    expect(museAdapter.readResponse({ choices: [] })).toBeNull();
  });

  it("reads error messages leniently", () => {
    expect(museAdapter.readErrorMessage('{"error":{"message":"bad stop","type":"invalid_request"}}')).toBe("bad stop");
    expect(museAdapter.readErrorMessage('{"error":"slow down"}')).toBe("slow down");
    expect(museAdapter.readErrorMessage("<html>gateway</html>")).toBeNull();
  });
});

describe("callMuse", () => {
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

  it("surfaces status and envelope message on an error, never the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('{"error":{"message":"Unsupported parameter: stop (key test-key-not-real)"}}', { status: 400 }),
      ),
    );
    const result = await callMuse({ system: "s", prompt: "p" });
    expect(result.error).toContain("HTTP 400");
    expect(result.error).toContain("Unsupported parameter: stop");
    expect(result.error).not.toContain("test-key-not-real");
    expect(result.meta?.httpStatus).toBe(400);
  });

  it("falls back to a plain status when the error body is not an envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too many", { status: 429 })));
    const result = await callMuse({ system: "s", prompt: "p" });
    expect(result.error).toBe("Muse returned HTTP 429");
  });

  it("reports latency and usage on success and honors per-call overrides", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({
        choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await callMuse({ system: "s", prompt: "p" }, { model: "muse-wonder-1.0", reasoningEffort: "medium" });
    expect(result.error).toBeNull();
    expect(result.data).toBe('{"ok":true}');
    expect(result.meta).toMatchObject({
      model: "muse-wonder-1.0",
      reasoningEffort: "medium",
      httpStatus: 200,
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      finishReason: "stop",
    });
    expect(result.meta?.latencyMs).toBeGreaterThanOrEqual(0);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(sentBody(init as RequestInit)).toMatchObject({ model: "muse-wonder-1.0", reasoning_effort: "medium" });
  });
});
