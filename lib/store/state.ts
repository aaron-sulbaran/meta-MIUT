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
