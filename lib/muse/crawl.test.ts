import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { crawlCandidates, orderStops, planCrawl } from "@/lib/muse/crawl";

const NOW = new Date("2026-11-12T22:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const from = { lat: 42.3616, lng: -71.0906 };
const to = { lat: 42.3555, lng: -71.1006 };

function event(id: string, lat: number, lng: number, extra: Partial<CampusEvent> = {}): CampusEvent {
  return {
    id, title: id, description: "", start: at(-10), end: at(90), place: { name: id, lat, lng },
    free: true, food: true, access: { kind: "open" }, organizer: { name: "Club", handle: "club" },
    source: { kind: "manual" }, status: "published", createdAt: at(-1000), ...extra,
  };
}

const pizza = event("pizza", 42.3601, -71.0942, { foodNote: "Pizza" });
const tacos = event("tacos", 42.3598, -71.0951, { foodNote: "Tacos" });
const boba = event("boba", 42.3581, -71.0967, { foodNote: "Boba" });
const shirts = event("shirts", 42.3570, -71.0985, { food: false, title: "Free club T-shirts" });
const far = event("far", 42.3736, -71.1190, { foodNote: "Pizza" });
const limited = event("limited", 42.3601, -71.0942, { access: { kind: "rsvp", capacity: 30 } });
const paid = event("paid", 42.3601, -71.0942, { free: false });
const all = [pizza, tacos, boba, shirts, far, limited, paid];

const reply = (content: string) =>
  Response.json({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });

describe("food crawl", () => {
  beforeEach(() => vi.stubEnv("MUSE_API_KEY", ""));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("only considers open free events near the way that are still on", () => {
    expect(crawlCandidates({ from, to }, all, NOW).map((e) => e.id).sort()).toEqual(["boba", "pizza", "shirts", "tacos"]);
  });

  it("orders stops for the shortest walk and drops one that ends before you arrive", () => {
    const soon = event("soon", 42.3570, -71.0985, { end: at(3) });
    const route = orderStops({ from, to }, [{ event: shirts, kind: "merch" }, { event: pizza, kind: "main" }, { event: soon, kind: "snack" }], NOW);
    expect(route.stops.map((s) => s.eventId)).toEqual(["pizza", "shirts"]);
  });

  it("without Muse, mixes kinds with one main course and drafts an invite", async () => {
    const result = await planCrawl({ from, to, note: "meeting my friend Sara" }, all, NOW);
    expect(result.source).toBe("fixture");
    const kinds = result.data!.stops.map((s) => s.kind);
    expect(kinds.filter((k) => k === "main")).toHaveLength(1);
    expect(kinds).toEqual(expect.arrayContaining(["main", "dessert", "merch"]));
    expect(result.data!.invite.path).toMatch(/^\/events\//);
  });

  it("rejects a Muse plan with two main courses", async () => {
    vi.stubEnv("MUSE_API_KEY", "test-key-not-real");
    const two = { stops: [{ eventId: "pizza", kind: "main" }, { eventId: "tacos", kind: "main" }], pitch: "Go", invite: { eventId: null, message: "Join me" } };
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify(two))));
    const result = await planCrawl({ from, to }, all, NOW);
    expect(result.source).toBe("fixture");
    expect(result.fallbackReason).toContain("two main");
  });
});

describe("food crawl with places the student names", () => {
  beforeEach(() => vi.stubEnv("MUSE_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("walks through each named place in order and ends at the last one", async () => {
    const result = await planCrawl({ from, to, note: "I'm going to Harvard Square and then Baker at 7" }, all, NOW);
    const plan = result.data!;
    expect(plan.stops.filter((s) => s.kind === "plan").map((s) => s.title)).toEqual(["Harvard Square"]);
    expect(plan.destination.name).toBe("Baker House");
    const harvard = plan.stops.findIndex((s) => s.kind === "plan");
    expect(plan.stops.slice(harvard + 1).every((s) => s.kind !== "plan")).toBe(true);
  });

  it("reads the arrive-by time after a place", async () => {
    const { itineraryFixture } = await import("@/lib/muse/fixtures/crawl");
    const { CRAWL_PLACES } = await import("@/lib/muse/crawl-places");
    expect(itineraryFixture("harvard first, then baker by 7:30", CRAWL_PLACES).places).toEqual([
      { name: "Harvard Square", arriveBy: null },
      { name: "Baker House", arriveBy: "19:30" },
    ]);
  });
});

describe("food crawl timing", () => {
  beforeEach(() => vi.stubEnv("MUSE_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("leaves the first place in time to reach the next one by its time", async () => {
    const result = await planCrawl({ from, to, note: "harvard then baker at 7" }, all, NOW);
    const plan = result.data!;
    // Tests run on the frozen Austin campus, so 7 PM is Central time.
    const sevenPm = Date.parse("2026-11-13T01:00:00.000Z");
    expect(plan.destination.name).toBe("Baker House");
    expect(Date.parse(plan.destination.arriveAt)).toBeLessThanOrEqual(sevenPm);
  });
});

describe("food crawl stops that cannot fit", () => {
  beforeEach(() => vi.stubEnv("MUSE_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("leaves out a stop that would make the student late for a place they named", async () => {
    const late = event("late", 42.3601, -71.0942, { title: "Late pizza", start: at(100), end: at(200), foodNote: "Pizza" });
    const result = await planCrawl({ from, to, note: "harvard then baker at 7" }, [late], NOW);
    expect(result.data!.stops.some((stop) => stop.eventId === "late")).toBe(false);
  });
});
