import "server-only";
import { z } from "zod";

// Muse (Meta Model API) client. Server side only; the key never reaches the browser.
//
// The real request shape is NOT confirmed. Everything inside `museAdapter`
// below is an unconfirmed guess (an OpenAI-style chat completions body) and
// must be checked against the docs at dev.meta.ai before it is trusted.
// TODO(muse lane): confirm endpoint path, auth header, body shape, image
// input format, and response shape from dev.meta.ai, then fix `museAdapter`.
// Nothing outside this file should depend on those details.

const MuseConfigSchema = z.object({
  MUSE_API_KEY: z.string().min(1),
  MUSE_BASE_URL: z.string().url(),
  MUSE_MODEL: z.string().min(1),
});

export type MuseConfig = { apiKey: string; baseUrl: string; model: string };

export type MuseImage = { base64: string; mediaType: string };

export type MuseRequest = {
  system: string;
  prompt: string;
  image?: MuseImage;
};

export type MuseCallResult = { data: string; error: null } | { data: null; error: string };

export function readMuseConfig(env: Record<string, string | undefined> = process.env):
  | { data: MuseConfig; error: null }
  | { data: null; error: string } {
  const result = MuseConfigSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    return { data: null, error: `Muse is not configured (${missing})` };
  }
  return {
    data: {
      apiKey: result.data.MUSE_API_KEY,
      baseUrl: result.data.MUSE_BASE_URL.replace(/\/$/, ""),
      model: result.data.MUSE_MODEL,
    },
    error: null,
  };
}

type HttpRequest = { url: string; init: RequestInit };

// UNCONFIRMED. The only place that knows the wire format.
export const museAdapter = {
  buildRequest(config: MuseConfig, request: MuseRequest): HttpRequest {
    const userContent: unknown[] = [{ type: "text", text: request.prompt }];
    if (request.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${request.image.mediaType};base64,${request.image.base64}` },
      });
    }
    return {
      url: `${config.baseUrl}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: userContent },
          ],
        }),
      },
    };
  },

  readText(responseBody: unknown): string | null {
    const parsed = z
      .object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) })
      .safeParse(responseBody);
    return parsed.success ? (parsed.data.choices[0]?.message.content ?? null) : null;
  },
};

const MUSE_TIMEOUT_MS = 20_000;

export async function callMuse(request: MuseRequest): Promise<MuseCallResult> {
  const config = readMuseConfig();
  if (config.error !== null) return { data: null, error: config.error };

  const { url, init } = museAdapter.buildRequest(config.data, request);
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(MUSE_TIMEOUT_MS) });
    if (!response.ok) return { data: null, error: `Muse returned HTTP ${response.status}` };
    const text = museAdapter.readText(await response.json());
    if (text === null) return { data: null, error: "Muse response did not match the expected shape" };
    return { data: text, error: null };
  } catch (cause) {
    return { data: null, error: `Muse call failed: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}
