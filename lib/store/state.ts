import "server-only";
import type { z } from "zod";
import { createRedisClient, readRedisConfig, storeNamespace, type RedisClient } from "@/lib/store/redis";

// Small JSON values (Muse interest memory, Ask Muse turns, Going together,
// nearby alerts already sent) kept in the shared Redis store when it is
// configured, so every server instance and restart sees the same state.
// Without Redis these are no-ops and state stays in the process.

const globalState = globalThis as typeof globalThis & { __jsonStateClient?: RedisClient | null };

function client(): RedisClient | null {
  if (globalState.__jsonStateClient === undefined) {
    const config = readRedisConfig();
    globalState.__jsonStateClient = config ? createRedisClient(config) : null;
  }
  return globalState.__jsonStateClient;
}

/** Tests swap in a fake client; undefined goes back to reading the environment. */
export function setStateClient(next: RedisClient | null | undefined): void {
  globalState.__jsonStateClient = next;
}

const keyFor = (name: string) => `${storeNamespace()}:state:${name}`;

export async function loadState<T>(name: string, schema: z.ZodType<T>): Promise<T | null> {
  const redis = client();
  if (!redis) return null;
  const reply = await redis.command(["GET", keyFor(name)]);
  if (reply.error !== null || typeof reply.data !== "string") return null;
  try {
    const parsed = schema.safeParse(JSON.parse(reply.data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveState(name: string, value: unknown): Promise<void> {
  const redis = client();
  if (!redis) return;
  await redis.command(["SET", keyFor(name), JSON.stringify(value)]);
}

const claims = globalThis as typeof globalThis & { __stateClaims?: Map<string, number> };

/**
 * Claims `name` for `ttlSeconds`: true for the first caller, false for anyone
 * else until it expires (Redis SET NX, so two server instances agree). Used to
 * make a repeated action harmless, such as the same invite sent from two phones.
 * Without Redis the claim lives in this process.
 */
export async function claimOnce(name: string, ttlSeconds: number, now = Date.now()): Promise<boolean> {
  const redis = client();
  if (redis) {
    const reply = await redis.command(["SET", keyFor(`claim:${name}`), String(now), "NX", "EX", ttlSeconds]);
    // A store failure lets the action through: better twice than never.
    return reply.error !== null || reply.data === "OK";
  }
  const held = (claims.__stateClaims ??= new Map());
  const until = held.get(name);
  if (until !== undefined && until > now) return false;
  held.set(name, now + ttlSeconds * 1000);
  return true;
}

/** Forgets this process's claims (the demo reset; stored claims go with their prefix). */
export function resetClaims(): void {
  claims.__stateClaims?.clear();
}

/**
 * Deletes every saved value whose name starts with one of the prefixes (the demo
 * reset). Without Redis there is nothing stored, so it deletes nothing.
 */
export async function deleteStatePrefixes(
  prefixes: string[],
): Promise<{ data: number; error: null } | { data: null; error: string }> {
  const redis = client();
  if (!redis) return { data: 0, error: null };
  let deleted = 0;
  for (const prefix of prefixes) {
    let cursor = "0";
    do {
      const reply = await redis.command(["SCAN", cursor, "MATCH", `${keyFor(prefix)}*`, "COUNT", 500]);
      if (reply.error !== null) return { data: null, error: reply.error };
      const [nextCursor, keys] = Array.isArray(reply.data) ? reply.data : ["0", []];
      const names = Array.isArray(keys) ? keys.map(String) : [];
      if (names.length > 0) {
        const removed = await redis.command(["DEL", ...names]);
        if (removed.error !== null) return { data: null, error: removed.error };
        deleted += typeof removed.data === "number" ? removed.data : names.length;
      }
      cursor = String(nextCursor ?? "0");
    } while (cursor !== "0");
  }
  return { data: deleted, error: null };
}
