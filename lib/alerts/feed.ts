import "server-only";
import { AlertSchema, type Alert, type AlertDraft, type AlertPage } from "@/lib/alerts/schema";
import type { StoreResult } from "@/lib/events/store";
import { createRedisClient, readRedisConfig, storeNamespace, type RedisClient } from "@/lib/store/redis";

// An append-only feed of alerts. Publishing assigns the next `seq`; screens
// poll `listSince(cursor)` and remember the returned cursor.
export type AlertFeed = {
  backend: "memory" | "redis";
  publish(draft: AlertDraft): Promise<StoreResult<Alert>>;
  // Alerts with seq above `cursor`, oldest first. A cursor ahead of the feed
  // (after a server restart in dev) is clamped so new alerts still arrive.
  listSince(cursor: number): Promise<StoreResult<AlertPage>>;
  latestCursor(): Promise<StoreResult<number>>;
  // Drops stored alerts but keeps the counter, so open screens keep polling.
  clear(): Promise<StoreResult<null>>;
};

export const ALERT_PAGE_LIMIT = 20;
const ALERTS_KEPT = 100;

type Clock = () => Date;

function newAlertId(seq: number, now: Date): string {
  return `alert-${now.getTime().toString(36)}-${seq}`;
}

export function createMemoryAlertFeed(now: Clock = () => new Date()): AlertFeed {
  let lastSeq = 0;
  let alerts: Alert[] = [];
  return {
    backend: "memory",
    async publish(draft) {
      lastSeq += 1;
      const createdAt = now();
      const alert = AlertSchema.parse({ ...draft, seq: lastSeq, id: newAlertId(lastSeq, createdAt), createdAt: createdAt.toISOString() });
      alerts = [...alerts, alert].slice(-ALERTS_KEPT);
      return { data: alert, error: null };
    },
    async listSince(cursor) {
      const since = Math.min(cursor, lastSeq);
      const page = alerts.filter((alert) => alert.seq > since).slice(0, ALERT_PAGE_LIMIT);
      return { data: { alerts: page, cursor: page.at(-1)?.seq ?? since }, error: null };
    },
    async latestCursor() {
      return { data: lastSeq, error: null };
    },
    async clear() {
      alerts = [];
      return { data: null, error: null };
    },
  };
}

function parseStoredAlert(raw: unknown): Alert | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = AlertSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function toCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

// Alerts live in a sorted set scored by seq; INCR on a counter key hands out seq.
export function createRedisAlertFeed(options: { client: RedisClient; namespace: string; now?: Clock }): AlertFeed {
  const { client, namespace } = options;
  const now = options.now ?? (() => new Date());
  const alertsKey = `${namespace}:alerts`;
  const seqKey = `${namespace}:alerts:seq`;

  return {
    backend: "redis",

    async publish(draft) {
      const next = await client.command(["INCR", seqKey]);
      if (next.error !== null) return { data: null, error: next.error };
      const seq = toCount(next.data);
      const createdAt = now();
      const parsed = AlertSchema.safeParse({ ...draft, seq, id: newAlertId(seq, createdAt), createdAt: createdAt.toISOString() });
      if (!parsed.success) return { data: null, error: parsed.error.message };
      const write = await client.pipeline([
        ["ZADD", alertsKey, seq, JSON.stringify(parsed.data)],
        ["ZREMRANGEBYRANK", alertsKey, 0, -(ALERTS_KEPT + 1)],
      ]);
      if (write.error !== null) return { data: null, error: write.error };
      return { data: parsed.data, error: null };
    },

    async listSince(cursor) {
      const result = await client.pipeline([
        ["GET", seqKey],
        ["ZRANGE", alertsKey, `(${Math.max(0, Math.floor(cursor))}`, "+inf", "BYSCORE", "LIMIT", 0, ALERT_PAGE_LIMIT],
      ]);
      if (result.error !== null) return { data: null, error: result.error };
      const [latestRaw, membersRaw] = result.data;
      const latest = toCount(latestRaw);
      const since = Math.min(cursor, latest);
      if (cursor > latest) return { data: { alerts: [], cursor: since }, error: null };
      const members = Array.isArray(membersRaw) ? membersRaw : [];
      const alerts = members.map(parseStoredAlert).filter((alert): alert is Alert => alert !== null);
      return { data: { alerts, cursor: alerts.at(-1)?.seq ?? since }, error: null };
    },

    async latestCursor() {
      const result = await client.command(["GET", seqKey]);
      if (result.error !== null) return { data: null, error: result.error };
      return { data: toCount(result.data), error: null };
    },

    async clear() {
      const result = await client.command(["DEL", alertsKey]);
      if (result.error !== null) return { data: null, error: result.error };
      return { data: null, error: null };
    },
  };
}

// Kept on globalThis for the same reason as the event store (lib/events/store.ts).
const globalFeed = globalThis as typeof globalThis & { __campusAlertFeed?: AlertFeed };

export function getAlertFeed(): AlertFeed {
  if (globalFeed.__campusAlertFeed) return globalFeed.__campusAlertFeed;
  const redisConfig = readRedisConfig();
  globalFeed.__campusAlertFeed = redisConfig
    ? createRedisAlertFeed({ client: createRedisClient(redisConfig), namespace: storeNamespace() })
    : createMemoryAlertFeed();
  return globalFeed.__campusAlertFeed;
}
