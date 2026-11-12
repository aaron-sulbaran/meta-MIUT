import { EventSchema, type CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { createRedisClient, readRedisConfig, storeNamespace, type RedisClient } from "@/lib/store/redis";

export type StoreResult<T> = { data: T; error: null } | { data: null; error: string };

// The store interface every caller uses. Two backends: Redis when its env vars
// are set (shared by every server instance, so a published event reaches every
// screen), and an in-memory map otherwise (local dev, tests).
export type EventStore = {
  backend: "memory" | "redis";
  listEvents(): Promise<CampusEvent[]>;
  getEvent(id: string): Promise<CampusEvent | null>;
  upsertEvent(event: CampusEvent): Promise<StoreResult<CampusEvent>>;
  // Replace every event with a fresh copy of the seed, times relative to `now`.
  resetToSeed(now: Date): Promise<StoreResult<number>>;
};

type SeedLoader = (now: Date) => CampusEvent[];

export function createMemoryStore(initialEvents: CampusEvent[], loadSeed: SeedLoader = loadSeedEvents): EventStore {
  const eventsById = new Map(initialEvents.map((event) => [event.id, event]));
  return {
    backend: "memory",
    async listEvents() {
      return [...eventsById.values()];
    },
    async getEvent(id) {
      return eventsById.get(id) ?? null;
    },
    async upsertEvent(event) {
      const result = EventSchema.safeParse(event);
      if (!result.success) return { data: null, error: result.error.message };
      eventsById.set(result.data.id, result.data);
      return { data: result.data, error: null };
    },
    async resetToSeed(now) {
      const seed = loadSeed(now);
      eventsById.clear();
      for (const event of seed) eventsById.set(event.id, event);
      return { data: seed.length, error: null };
    },
  };
}

// Seeds carry relative times, so they expire and get re-seeded fresh. A reset
// from the demo console re-seeds on demand.
const SEED_TTL_SECONDS = 12 * 60 * 60;
const SEED_CHECK_INTERVAL_MS = 60_000;

function parseStoredEvent(raw: unknown): CampusEvent | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = EventSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function seedFields(events: CampusEvent[]): string[] {
  return events.flatMap((event) => [event.id, JSON.stringify(event)]);
}

// Reads that fail fall back to `fallback` (the in-memory seed) so a screen is
// never empty in the demo; writes that fail return the error.
export function createRedisEventStore(options: {
  client: RedisClient;
  namespace: string;
  loadSeed?: SeedLoader;
  fallback: EventStore;
  now?: () => Date;
}): EventStore {
  const { client, namespace, fallback } = options;
  const loadSeed = options.loadSeed ?? loadSeedEvents;
  const now = options.now ?? (() => new Date());
  const eventsKey = `${namespace}:events`;
  const seededKey = `${namespace}:events:seeded`;
  let lastSeedCheckMs = Number.NEGATIVE_INFINITY;

  async function ensureSeeded(): Promise<string | null> {
    const checkedAt = now().getTime();
    if (checkedAt - lastSeedCheckMs < SEED_CHECK_INTERVAL_MS) return null;
    const claim = await client.command(["SET", seededKey, now().toISOString(), "NX", "EX", SEED_TTL_SECONDS]);
    if (claim.error !== null) return claim.error;
    if (claim.data === "OK") {
      const seed = loadSeed(now());
      if (seed.length > 0) {
        const write = await client.command(["HSET", eventsKey, ...seedFields(seed)]);
        if (write.error !== null) {
          await client.command(["DEL", seededKey]);
          return write.error;
        }
      }
    }
    lastSeedCheckMs = checkedAt;
    return null;
  }

  function logFallback(operation: string, error: string) {
    console.error(`Event store: ${operation} fell back to memory (${error})`);
  }

  return {
    backend: "redis",

    async listEvents() {
      const seedError = await ensureSeeded();
      if (seedError !== null) {
        logFallback("listEvents", seedError);
        return fallback.listEvents();
      }
      const values = await client.command(["HVALS", eventsKey]);
      if (values.error !== null || !Array.isArray(values.data)) {
        logFallback("listEvents", values.error ?? "HVALS did not return a list");
        return fallback.listEvents();
      }
      return values.data.map(parseStoredEvent).filter((event): event is CampusEvent => event !== null);
    },

    async getEvent(id) {
      const seedError = await ensureSeeded();
      if (seedError !== null) {
        logFallback("getEvent", seedError);
        return fallback.getEvent(id);
      }
      const value = await client.command(["HGET", eventsKey, id]);
      if (value.error !== null) {
        logFallback("getEvent", value.error);
        return fallback.getEvent(id);
      }
      return parseStoredEvent(value.data);
    },

    async upsertEvent(event) {
      const parsed = EventSchema.safeParse(event);
      if (!parsed.success) return { data: null, error: parsed.error.message };
      const seedError = await ensureSeeded();
      if (seedError !== null) return { data: null, error: seedError };
      const write = await client.command(["HSET", eventsKey, parsed.data.id, JSON.stringify(parsed.data)]);
      if (write.error !== null) return { data: null, error: write.error };
      return { data: parsed.data, error: null };
    },

    async resetToSeed(resetAt) {
      const seed = loadSeed(resetAt);
      const commands: [string, ...(string | number)[]][] = [["DEL", eventsKey]];
      if (seed.length > 0) commands.push(["HSET", eventsKey, ...seedFields(seed)]);
      commands.push(["SET", seededKey, resetAt.toISOString(), "EX", SEED_TTL_SECONDS]);
      const result = await client.pipeline(commands);
      if (result.error !== null) return { data: null, error: result.error };
      lastSeedCheckMs = now().getTime();
      return { data: seed.length, error: null };
    },
  };
}

// One store per server process, kept on globalThis because Next dev compiles
// route handlers and pages as separate module graphs; without this, an event
// published through /api/events would not show on a page in local dev. With
// Redis configured every process shares the same data anyway.
const globalStore = globalThis as typeof globalThis & { __campusEventStore?: EventStore };

export function getEventStore(): EventStore {
  if (globalStore.__campusEventStore) return globalStore.__campusEventStore;
  const memory = createMemoryStore(loadSeedEvents(new Date()));
  const redisConfig = readRedisConfig();
  globalStore.__campusEventStore = redisConfig
    ? createRedisEventStore({ client: createRedisClient(redisConfig), namespace: storeNamespace(), fallback: memory })
    : memory;
  return globalStore.__campusEventStore;
}
