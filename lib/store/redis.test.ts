import { describe, expect, it, vi } from "vitest";
import { createRedisClient, readRedisConfig, storeNamespace } from "@/lib/store/redis";

const config = { url: "https://example-redis.test", token: "test-token" };

function firstCall(fetchImpl: ReturnType<typeof fakeFetch>) {
  const call = fetchImpl.mock.calls[0];
  if (!call) throw new Error("fetch was not called");
  return call;
}

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe("readRedisConfig", () => {
  it("reads the Marketplace pair", () => {
    expect(readRedisConfig({ KV_REST_API_URL: "https://kv.test/", KV_REST_API_TOKEN: "abc" })).toEqual({
      url: "https://kv.test",
      token: "abc",
    });
  });

  it("falls back to the direct Upstash pair", () => {
    expect(readRedisConfig({ UPSTASH_REDIS_REST_URL: "https://up.test", UPSTASH_REDIS_REST_TOKEN: "xyz" })).toEqual({
      url: "https://up.test",
      token: "xyz",
    });
  });

  it("returns null when nothing usable is set", () => {
    expect(readRedisConfig({})).toBeNull();
    expect(readRedisConfig({ KV_REST_API_URL: "not a url", KV_REST_API_TOKEN: "abc" })).toBeNull();
    expect(readRedisConfig({ KV_REST_API_URL: "https://kv.test", KV_REST_API_TOKEN: " " })).toBeNull();
  });
});

describe("createRedisClient", () => {
  it("posts one command as a JSON array with the bearer token", async () => {
    const fetchImpl = fakeFetch(200, { result: "OK" });
    const result = await createRedisClient(config, fetchImpl).command(["SET", "key", "value"]);
    expect(result).toEqual({ data: "OK", error: null });
    const [url, init] = firstCall(fetchImpl);
    expect(url).toBe("https://example-redis.test");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(init?.body))).toEqual(["SET", "key", "value"]);
  });

  it("surfaces a Redis error reply", async () => {
    const result = await createRedisClient(config, fakeFetch(400, { error: "ERR wrong type" })).command(["GET", "k"]);
    expect(result).toEqual({ data: null, error: "Redis error: ERR wrong type" });
  });

  it("sends a pipeline to /pipeline and returns results in order", async () => {
    const fetchImpl = fakeFetch(200, [{ result: 1 }, { result: ["a"] }]);
    const result = await createRedisClient(config, fetchImpl).pipeline([
      ["INCR", "n"],
      ["HVALS", "h"],
    ]);
    expect(result).toEqual({ data: [1, ["a"]], error: null });
    expect(firstCall(fetchImpl)[0]).toBe("https://example-redis.test/pipeline");
  });

  it("fails the pipeline when any command fails", async () => {
    const result = await createRedisClient(config, fakeFetch(200, [{ result: 1 }, { error: "ERR boom" }])).pipeline([
      ["INCR", "n"],
      ["INCR", "m"],
    ]);
    expect(result.error).toBe("Redis error: ERR boom");
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("offline");
    });
    const result = await createRedisClient(config, fetchImpl).command(["GET", "k"]);
    expect(result).toEqual({ data: null, error: "Redis call failed: offline" });
  });
});

describe("storeNamespace", () => {
  it("separates Vercel environments", () => {
    expect(storeNamespace({ VERCEL_ENV: "production" })).toBe("miut:v1:production");
    expect(storeNamespace({})).toBe("miut:v1:local");
  });
});
