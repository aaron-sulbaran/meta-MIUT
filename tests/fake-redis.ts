import type { RedisClient, RedisCommand, RedisResult } from "@/lib/store/redis";

// An in-memory stand-in for the handful of Redis commands the store and alert
// feed use. Expiry is ignored. `failNext` makes the next command return an error.
export function createFakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sortedSets = new Map<string, { score: number; member: string }[]>();
  const sets = new Map<string, Set<string>>();
  const log: RedisCommand[] = [];
  let failures = 0;

  function hash(key: string) {
    let value = hashes.get(key);
    if (!value) {
      value = new Map();
      hashes.set(key, value);
    }
    return value;
  }

  function plainSet(key: string) {
    let value = sets.get(key);
    if (!value) {
      value = new Set();
      sets.set(key, value);
    }
    return value;
  }

  function zset(key: string) {
    let value = sortedSets.get(key);
    if (!value) {
      value = [];
      sortedSets.set(key, value);
    }
    return value;
  }

  function run(command: RedisCommand): RedisResult<unknown> {
    log.push(command);
    if (failures > 0) {
      failures -= 1;
      return { data: null, error: "Redis error: simulated failure" };
    }
    const [name, ...args] = command;
    const text = args.map(String);
    const at = (index: number): string => text[index] ?? "";
    switch (name.toUpperCase()) {
      case "SET": {
        const key = at(0);
        if (text.slice(2).includes("NX") && strings.has(key)) return { data: null, error: null };
        strings.set(key, at(1));
        return { data: "OK", error: null };
      }
      case "GET":
        return { data: strings.get(at(0)) ?? null, error: null };
      case "INCR": {
        const next = Number(strings.get(at(0)) ?? 0) + 1;
        strings.set(at(0), String(next));
        return { data: next, error: null };
      }
      case "DEL": {
        let removed = 0;
        for (const key of text) {
          if (strings.delete(key) || hashes.delete(key) || sortedSets.delete(key) || sets.delete(key)) removed += 1;
        }
        return { data: removed, error: null };
      }
      case "HSET": {
        const target = hash(at(0));
        for (let index = 1; index < text.length; index += 2) target.set(at(index), at(index + 1));
        return { data: (text.length - 1) / 2, error: null };
      }
      case "HGET":
        return { data: hashes.get(at(0))?.get(at(1)) ?? null, error: null };
      case "HVALS":
        return { data: [...(hashes.get(at(0))?.values() ?? [])], error: null };
      case "ZADD": {
        const target = zset(at(0));
        target.push({ score: Number(at(1)), member: at(2) });
        target.sort((first, second) => first.score - second.score);
        return { data: 1, error: null };
      }
      case "ZREMRANGEBYRANK": {
        const target = zset(at(0));
        const length = target.length;
        const start = Number(at(1));
        const stop = Number(at(2));
        const from = start < 0 ? length + start : start;
        const to = stop < 0 ? length + stop : stop;
        if (to < from || from >= length) return { data: 0, error: null };
        const removed = target.splice(Math.max(0, from), to - Math.max(0, from) + 1);
        return { data: removed.length, error: null };
      }
      case "ZRANGE": {
        // Only the BYSCORE form with an exclusive lower bound and LIMIT is used.
        const exclusiveMin = Number(at(1).replace("(", ""));
        const offset = Number(at(5));
        const count = Number(at(6));
        const members = zset(at(0))
          .filter((entry) => entry.score > exclusiveMin)
          .slice(offset, offset + count)
          .map((entry) => entry.member);
        return { data: members, error: null };
      }
      case "SADD": {
        const target = plainSet(at(0));
        const before = target.size;
        for (const member of text.slice(1)) target.add(member);
        return { data: target.size - before, error: null };
      }
      case "SREM": {
        const target = plainSet(at(0));
        let removed = 0;
        for (const member of text.slice(1)) if (target.delete(member)) removed += 1;
        return { data: removed, error: null };
      }
      case "SCARD":
        return { data: sets.get(at(0))?.size ?? 0, error: null };
      case "SISMEMBER":
        return { data: sets.get(at(0))?.has(at(1)) ? 1 : 0, error: null };
      case "SMEMBERS":
        return { data: [...(sets.get(at(0)) ?? [])], error: null };
      default:
        return { data: null, error: `Redis error: fake does not support ${name}` };
    }
  }

  const client: RedisClient = {
    async command(command) {
      return run(command);
    },
    async pipeline(commands) {
      const results: unknown[] = [];
      for (const command of commands) {
        const result = run(command);
        if (result.error !== null) return result;
        results.push(result.data);
      }
      return { data: results, error: null };
    },
  };

  return {
    client,
    log,
    strings,
    hashes,
    sets,
    failNext(count = 1) {
      failures = count;
    },
  };
}
