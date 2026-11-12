import "server-only";
import {
  EVENT_FULL_ERROR,
  type AttendanceAction,
  type AttendanceSummary,
} from "@/lib/attendance/schema";
import type { CampusEvent } from "@/lib/events/schema";
import type { StoreResult } from "@/lib/events/store";
import { createRedisClient, readRedisConfig, storeNamespace, type RedisClient } from "@/lib/store/redis";

// Who is interested in and going to each event, as sets of viewer ids. Same
// backend rule as the event store: Redis when configured, memory otherwise.
export type AttendanceStore = {
  backend: "memory" | "redis";
  summary(event: CampusEvent, viewerId: string | null): Promise<StoreResult<AttendanceSummary>>;
  // RSVP on a full event returns EVENT_FULL_ERROR and leaves state unchanged.
  apply(event: CampusEvent, viewerId: string, action: AttendanceAction): Promise<StoreResult<AttendanceSummary>>;
  clearAll(): Promise<StoreResult<null>>;
};

type Counts = { interested: number; going: number; viewerInterested: boolean; viewerGoing: boolean };

function capacityOf(event: CampusEvent): number | null {
  return event.access.kind === "rsvp" && event.access.capacity !== undefined ? event.access.capacity : null;
}

function toSummary(event: CampusEvent, counts: Counts, viewerId: string | null): AttendanceSummary {
  const capacity = capacityOf(event);
  return {
    eventId: event.id,
    interestedCount: counts.interested,
    goingCount: counts.going,
    capacity,
    seatsLeft: capacity === null ? null : Math.max(0, capacity - counts.going),
    viewer: viewerId === null ? null : { interested: counts.viewerInterested, going: counts.viewerGoing },
  };
}

export function createMemoryAttendanceStore(): AttendanceStore {
  const interestedByEvent = new Map<string, Set<string>>();
  const goingByEvent = new Map<string, Set<string>>();

  function setFor(map: Map<string, Set<string>>, eventId: string): Set<string> {
    let viewers = map.get(eventId);
    if (!viewers) {
      viewers = new Set();
      map.set(eventId, viewers);
    }
    return viewers;
  }

  function counts(eventId: string, viewerId: string | null): Counts {
    const interested = setFor(interestedByEvent, eventId);
    const going = setFor(goingByEvent, eventId);
    return {
      interested: interested.size,
      going: going.size,
      viewerInterested: viewerId !== null && interested.has(viewerId),
      viewerGoing: viewerId !== null && going.has(viewerId),
    };
  }

  return {
    backend: "memory",
    async summary(event, viewerId) {
      return { data: toSummary(event, counts(event.id, viewerId), viewerId), error: null };
    },
    async apply(event, viewerId, action) {
      const interested = setFor(interestedByEvent, event.id);
      const going = setFor(goingByEvent, event.id);
      switch (action) {
        case "interested":
          interested.add(viewerId);
          break;
        case "not_interested":
          interested.delete(viewerId);
          break;
        case "rsvp": {
          const capacity = capacityOf(event);
          if (!going.has(viewerId) && capacity !== null && going.size >= capacity) {
            return { data: null, error: EVENT_FULL_ERROR };
          }
          going.add(viewerId);
          break;
        }
        case "cancel_rsvp":
          going.delete(viewerId);
          break;
      }
      return { data: toSummary(event, counts(event.id, viewerId), viewerId), error: null };
    },
    async clearAll() {
      interestedByEvent.clear();
      goingByEvent.clear();
      return { data: null, error: null };
    },
  };
}

function toCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function createRedisAttendanceStore(options: { client: RedisClient; namespace: string }): AttendanceStore {
  const { client, namespace } = options;
  const indexKey = `${namespace}:attendance:events`;
  const interestedKey = (eventId: string) => `${namespace}:attendance:${eventId}:interested`;
  const goingKey = (eventId: string) => `${namespace}:attendance:${eventId}:going`;

  async function readCounts(eventId: string, viewerId: string | null): Promise<StoreResult<Counts>> {
    const member = viewerId ?? "";
    const result = await client.pipeline([
      ["SCARD", interestedKey(eventId)],
      ["SCARD", goingKey(eventId)],
      ["SISMEMBER", interestedKey(eventId), member],
      ["SISMEMBER", goingKey(eventId), member],
    ]);
    if (result.error !== null) return result;
    const [interested, going, viewerInterested, viewerGoing] = result.data;
    return {
      data: {
        interested: toCount(interested),
        going: toCount(going),
        viewerInterested: viewerId !== null && toCount(viewerInterested) === 1,
        viewerGoing: viewerId !== null && toCount(viewerGoing) === 1,
      },
      error: null,
    };
  }

  async function summarize(event: CampusEvent, viewerId: string | null): Promise<StoreResult<AttendanceSummary>> {
    const counts = await readCounts(event.id, viewerId);
    if (counts.error !== null) return counts;
    return { data: toSummary(event, counts.data, viewerId), error: null };
  }

  return {
    backend: "redis",

    summary: summarize,

    async apply(event, viewerId, action) {
      if (action === "rsvp") {
        // Check then add: two viewers racing for the last seat could both get
        // it. Acceptable for a demo; a Lua script would close the gap.
        const before = await readCounts(event.id, viewerId);
        if (before.error !== null) return before;
        const capacity = capacityOf(event);
        if (!before.data.viewerGoing && capacity !== null && before.data.going >= capacity) {
          return { data: null, error: EVENT_FULL_ERROR };
        }
      }
      const write: [string, ...(string | number)[]] =
        action === "interested"
          ? ["SADD", interestedKey(event.id), viewerId]
          : action === "not_interested"
            ? ["SREM", interestedKey(event.id), viewerId]
            : action === "rsvp"
              ? ["SADD", goingKey(event.id), viewerId]
              : ["SREM", goingKey(event.id), viewerId];
      const written = await client.pipeline([write, ["SADD", indexKey, event.id]]);
      if (written.error !== null) return written;
      return summarize(event, viewerId);
    },

    async clearAll() {
      const index = await client.command(["SMEMBERS", indexKey]);
      if (index.error !== null) return index;
      const eventIds = Array.isArray(index.data) ? index.data.map(String) : [];
      const keys = eventIds.flatMap((eventId) => [interestedKey(eventId), goingKey(eventId)]);
      const deleted = await client.command(["DEL", indexKey, ...keys]);
      if (deleted.error !== null) return deleted;
      return { data: null, error: null };
    },
  };
}

// Kept on globalThis for the same reason as the event store (lib/events/store.ts).
const globalAttendance = globalThis as typeof globalThis & { __campusAttendanceStore?: AttendanceStore };

export function getAttendanceStore(): AttendanceStore {
  if (globalAttendance.__campusAttendanceStore) return globalAttendance.__campusAttendanceStore;
  const redisConfig = readRedisConfig();
  globalAttendance.__campusAttendanceStore = redisConfig
    ? createRedisAttendanceStore({ client: createRedisClient(redisConfig), namespace: storeNamespace() })
    : createMemoryAttendanceStore();
  return globalAttendance.__campusAttendanceStore;
}
