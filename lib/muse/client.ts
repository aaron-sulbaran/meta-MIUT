import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

// Muse (Meta Model API) client. Server side only; the key never reaches the browser.
//
// The wire format in `museAdapter` was confirmed against the dev.meta.ai docs on
// 2026-11-12: OpenAI-style chat completions at `${baseUrl}/chat/completions`.
// The live call was confirmed on 2026-11-12 with `pnpm spike:muse`. Nothing outside
// this file should depend on the wire format.
//
// Ember is the default because the flyer extract measured about 2.4 to 3.3 s on
// `muse-ember-1.0` at low effort, versus 30 to 64 s on `muse-spark-1.3` and 47 s on
// `muse-wonder-1.0`, which is past the 20 s app timeout. All three passed the schema.

export const DEFAULT_MUSE_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_MUSE_MODEL = "muse-ember-1.0";
export const MUSE_MODELS = ["muse-spark-1.3", "muse-wonder-1.0", "muse-ember-1.0"] as const;

// `none` is rejected by the API. Server defaults are `high` (Spark) or `max`
// (Wonder, Ember), which is slow, so we always send an explicit value.
export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

// App path timeout. Image reads at low effort should land well inside this;
// the spike script passes its own longer timeout to measure slow models.
export const MUSE_TIMEOUT_MS = 20_000;

const ERROR_MESSAGE_MAX_LENGTH = 300;

const emptyAsUnset = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const MuseConfigSchema = z.object({
  MUSE_API_KEY: z.string().trim().min(1),
  MUSE_BASE_URL: z.preprocess(emptyAsUnset, z.url().default(DEFAULT_MUSE_BASE_URL)),
  MUSE_MODEL: z.preprocess(emptyAsUnset, z.string().trim().min(1).default(DEFAULT_MUSE_MODEL)),
  MUSE_REASONING_EFFORT: z.preprocess(emptyAsUnset, z.enum(REASONING_EFFORTS).default(DEFAULT_REASONING_EFFORT)),
});

export type MuseConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasoningEffort: ReasoningEffort;
};

export type MuseImage = { base64: string; mediaType: string };

// A JSON schema the model output is constrained to. `name` must match [A-Za-z0-9_-].
export type MuseStructuredOutput = { name: string; schema: Record<string, unknown> };

export type MuseRequest = {
  system: string;
  prompt: string;
  image?: MuseImage;
  structuredOutput?: MuseStructuredOutput;
  maxCompletionTokens?: number;
};

export type MuseUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

export type MuseCallMeta = {
  model: string;
  reasoningEffort: ReasoningEffort;
  httpStatus: number | null;
  latencyMs: number | null;
  usage: MuseUsage | null;
  finishReason: string | null;
};

// `meta` is null only when the call never started (missing or invalid config).
export type MuseCallResult =
  | { data: string; error: null; meta: MuseCallMeta }
  | { data: null; error: string; meta: MuseCallMeta | null };

export type MuseCallOptions = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
};

export function readMuseConfig(env: Record<string, string | undefined> = process.env):
  | { data: MuseConfig; error: null }
  | { data: null; error: string } {
  const result = MuseConfigSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    return { data: null, error: `Muse is not configured (${fields})` };
  }
  return {
    data: {
      apiKey: result.data.MUSE_API_KEY,
      baseUrl: result.data.MUSE_BASE_URL.replace(/\/$/, ""),
      model: result.data.MUSE_MODEL,
      reasoningEffort: result.data.MUSE_REASONING_EFFORT,
    },
    error: null,
  };
}

type HttpRequest = { url: string; init: RequestInit };

export type MuseResponse = { text: string; usage: MuseUsage | null; finishReason: string | null };

const CompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number(), total_tokens: z.number() })
    .nullish(),
});

const ErrorEnvelopeSchema = z.union([
  z.object({ error: z.object({ message: z.string() }) }),
  z.object({ error: z.string() }),
  z.object({ message: z.string() }),
]);

// The only place that knows the wire format.
export const museAdapter = {
  buildRequest(config: MuseConfig, request: MuseRequest): HttpRequest {
    const userContent: unknown[] = [{ type: "text", text: request.prompt }];
    if (request.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${request.image.mediaType};base64,${request.image.base64}` },
      });
    }
    const body: Record<string, unknown> = {
      model: config.model,
      messages: [
        { role: "developer", content: request.system },
        { role: "user", content: userContent },
      ],
      reasoning_effort: config.reasoningEffort,
    };
    if (request.maxCompletionTokens !== undefined) body.max_completion_tokens = request.maxCompletionTokens;
    if (request.structuredOutput) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: request.structuredOutput.name, strict: false, schema: request.structuredOutput.schema },
      };
    }
    return {
      url: `${config.baseUrl}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    };
  },

  readResponse(responseBody: unknown): MuseResponse | null {
    const parsed = CompletionSchema.safeParse(responseBody);
    if (!parsed.success) return null;
    const choice = parsed.data.choices[0];
    if (!choice) return null;
    const usage = parsed.data.usage;
    return {
      text: choice.message.content,
      usage: usage
        ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens }
        : null,
      finishReason: choice.finish_reason ?? null,
    };
  },

  // Lenient: the error body is not documented beyond being OpenAI-style.
  readErrorMessage(responseText: string): string | null {
    let body: unknown;
    try {
      body = JSON.parse(responseText);
    } catch {
      return null;
    }
    const parsed = ErrorEnvelopeSchema.safeParse(body);
    if (!parsed.success) return null;
    const envelope = parsed.data;
    if ("message" in envelope) return envelope.message;
    return typeof envelope.error === "string" ? envelope.error : envelope.error.message;
  },
};

function describeHttpError(status: number, message: string | null, apiKey: string): string {
  if (message === null || message.trim() === "") return `Muse returned HTTP ${status}`;
  const safeMessage = message.split(apiKey).join("[redacted]").slice(0, ERROR_MESSAGE_MAX_LENGTH);
  return `Muse returned HTTP ${status}: ${safeMessage}`;
}

// Muse switched off for one request (the demo's time budget, lib/demo/head-start.ts): every
// call inside answers with `reason` as an error, so each job takes its own fixture path.
const museOff = new AsyncLocalStorage<string>();

/** Runs `run` with Muse switched off; its jobs fall back to their fixtures, saying `reason`. */
export function withoutMuse<T>(reason: string, run: () => Promise<T>): Promise<T> {
  return museOff.run(reason, run);
}

export async function callMuse(request: MuseRequest, options: MuseCallOptions = {}): Promise<MuseCallResult> {
  const offReason = museOff.getStore();
  if (offReason !== undefined) return { data: null, error: offReason, meta: null };
  const config = readMuseConfig();
  if (config.error !== null) return { data: null, error: config.error, meta: null };

  const effectiveConfig: MuseConfig = {
    ...config.data,
    model: options.model ?? config.data.model,
    reasoningEffort: options.reasoningEffort ?? config.data.reasoningEffort,
  };
  const meta: MuseCallMeta = {
    model: effectiveConfig.model,
    reasoningEffort: effectiveConfig.reasoningEffort,
    httpStatus: null,
    latencyMs: null,
    usage: null,
    finishReason: null,
  };

  const { url, init } = museAdapter.buildRequest(effectiveConfig, request);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(options.timeoutMs ?? MUSE_TIMEOUT_MS),
    });
    meta.httpStatus = response.status;
    const responseText = await response.text();
    meta.latencyMs = Math.round(performance.now() - startedAt);
    console.info(`[legs] muse ${request.structuredOutput?.name ?? "text"} ${meta.latencyMs} ms, HTTP ${response.status}`);

    if (!response.ok) {
      const message = museAdapter.readErrorMessage(responseText);
      return { data: null, error: describeHttpError(response.status, message, effectiveConfig.apiKey), meta };
    }

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      return { data: null, error: "Muse response was not JSON", meta };
    }
    const parsed = museAdapter.readResponse(responseBody);
    if (parsed === null) return { data: null, error: "Muse response did not match the expected shape", meta };
    meta.usage = parsed.usage;
    meta.finishReason = parsed.finishReason;
    return { data: parsed.text, error: null, meta };
  } catch (cause) {
    meta.latencyMs = Math.round(performance.now() - startedAt);
    console.info(`[legs] muse ${request.structuredOutput?.name ?? "text"} ${meta.latencyMs} ms, failed`);
    return {
      data: null,
      error: `Muse call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      meta,
    };
  }
}
