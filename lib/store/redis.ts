import "server-only";
import { z } from "zod";

// A minimal client for the Upstash Redis REST API (what the Vercel Marketplace
// Redis integration provisions). Plain fetch, no SDK: one command is a JSON
// array POSTed to the base URL; several go to /pipeline in one round trip.
// Each reply is { result } or { error }.

export type RedisConfig = { url: string; token: string };

export type RedisValue = string | number;
export type RedisCommand = [string, ...RedisValue[]];

export type RedisResult<T> = { data: T; error: null } | { data: null; error: string };

export type RedisClient = {
  command(command: RedisCommand): Promise<RedisResult<unknown>>;
  pipeline(commands: RedisCommand[]): Promise<RedisResult<unknown[]>>;
};

const REDIS_TIMEOUT_MS = 5_000;

const nonEmpty = z.string().trim().min(1);

// The Marketplace integration injects KV_REST_API_*; a direct Upstash setup uses
// UPSTASH_REDIS_REST_*. Either pair works.
export function readRedisConfig(env: Record<string, string | undefined> = process.env): RedisConfig | null {
  const pairs: [string | undefined, string | undefined][] = [
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
  ];
  for (const [url, token] of pairs) {
    const parsedUrl = z.url().safeParse(url?.trim());
    const parsedToken = nonEmpty.safeParse(token);
    if (parsedUrl.success && parsedToken.success) {
      return { url: parsedUrl.data.replace(/\/$/, ""), token: parsedToken.data };
    }
  }
  return null;
}

const ReplySchema = z.union([z.object({ result: z.unknown() }), z.object({ error: z.string() })]);

function readReply(reply: unknown): RedisResult<unknown> {
  const parsed = ReplySchema.safeParse(reply);
  if (!parsed.success) return { data: null, error: "Redis reply did not match the expected shape" };
  if ("error" in parsed.data) return { data: null, error: `Redis error: ${parsed.data.error}` };
  return { data: parsed.data.result, error: null };
}

export function createRedisClient(config: RedisConfig, fetchImpl: typeof fetch = fetch): RedisClient {
  async function post(path: string, body: unknown): Promise<RedisResult<unknown>> {
    try {
      const response = await fetchImpl(`${config.url}${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
      });
      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { data: null, error: `Redis returned HTTP ${response.status} with a non-JSON body` };
      }
      if (!response.ok) {
        const reply = readReply(json);
        return { data: null, error: reply.error ?? `Redis returned HTTP ${response.status}` };
      }
      return { data: json, error: null };
    } catch (cause) {
      return { data: null, error: `Redis call failed: ${cause instanceof Error ? cause.message : String(cause)}` };
    }
  }

  return {
    async command(command) {
      const response = await post("", command);
      if (response.error !== null) return response;
      return readReply(response.data);
    },

    async pipeline(commands) {
      if (commands.length === 0) return { data: [], error: null };
      const response = await post("/pipeline", commands);
      if (response.error !== null) return response;
      const replies = z.array(z.unknown()).safeParse(response.data);
      if (!replies.success || replies.data.length !== commands.length) {
        return { data: null, error: "Redis pipeline reply did not match the command count" };
      }
      const results: unknown[] = [];
      for (const reply of replies.data) {
        const result = readReply(reply);
        if (result.error !== null) return result;
        results.push(result.data);
      }
      return { data: results, error: null };
    },
  };
}

// Keys are namespaced per Vercel environment so preview deploys never touch
// production demo data. Bump the version if stored shapes change.
export function storeNamespace(env: Record<string, string | undefined> = process.env): string {
  return `miut:v1:${env.VERCEL_ENV ?? "local"}`;
}
