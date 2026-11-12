import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSeedEvents } from "@/lib/events/seed";
import { extractFixture } from "@/lib/muse/fixtures/extract";
import { matchCandidates, matchExistingEvent } from "@/lib/muse/match";

const now = new Date("2026-11-12T20:00:00Z");
const events = loadSeedEvents(now);
const listed = events[0]!;
const repost = {
  ...extractFixture(now),
  title: listed.title,
  start: listed.start,
  end: listed.end,
  placeName: "Gregory Gym, room 2",
  free: !listed.free,
};
const handle = listed.organizer.handle;

const reply = (content: string) =>
  Response.json({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });

describe("matchCandidates", () => {
  it("keeps the same organizer within a week and others only within two hours", () => {
    expect(matchCandidates(repost, handle.toUpperCase(), events).map((event) => event.id)).toContain(listed.id);
    const farAway = { ...repost, start: new Date(Date.parse(listed.start) + 5 * 3_600_000).toISOString() };
    expect(matchCandidates(farAway, "@someone-else", [listed])).toEqual([]);
  });
});

describe("matchExistingEvent", () => {
  beforeEach(() => {
    vi.stubEnv("MUSE_API_KEY", "test-key-not-real");
    vi.stubEnv("MUSE_BASE_URL", "");
    vi.stubEnv("MUSE_MODEL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips Muse when nothing could match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await matchExistingEvent({ draft: repost, organizerHandle: "@nobody" }, []);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ eventId: null, updates: {} });
  });

  it("returns only the stated fields that differ", async () => {
    const draft = { ...repost, evidence: { ...repost.evidence, free: { quote: "", from: "inferred" as const } } };
    const changed = ["title", "placeName", "free"];
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify({ sameAs: listed.id, reason: "Repost", changed }))));
    const result = await matchExistingEvent({ draft, organizerHandle: handle }, events);
    expect(result.source).toBe("muse");
    expect(result.data).toEqual({ eventId: listed.id, reason: "Repost", updates: { placeName: "Gregory Gym, room 2" } });
  });

  it("rejects an invented id and treats the post as new", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply('{"sameAs":"evt-made-up","reason":"x","changed":[]}')));
    const result = await matchExistingEvent({ draft: repost, organizerHandle: handle }, events);
    expect(result.source).toBe("fixture");
    expect(result.data).toMatchObject({ eventId: null, updates: {} });
  });
});
