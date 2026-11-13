import { describe, expect, it } from "vitest";
import { canJoinAt, castFromSlug, decidePhoneMove, nextActStart, inFrameMessage, nextCast, phoneView } from "@/lib/demo/beat-context";
import { BEATS, type CastId } from "@/lib/demo/beats";

const at = (id: string) => BEATS.findIndex((beat) => beat.id === id);
const firstOf = (cast: CastId) => BEATS.findIndex((beat) => beat.act !== "pitch" && phoneView(BEATS.indexOf(beat), cast).kind === "scene");
const lastOf = (cast: CastId) => BEATS.length - 1 - [...BEATS].reverse().findIndex((beat) => phoneView(BEATS.indexOf(beat), cast).kind === "scene");

describe("who may move the stage from their own phone", () => {
  it("lets the person whose beat it is move on", () => {
    const start = firstOf("organizer");
    expect(decidePhoneMove(start, { action: "next", from: "organizer", at: start })).toEqual({ ok: true, index: start + 1 });
  });

  it("refuses anyone else, and anyone on the pitch beats", () => {
    const start = firstOf("organizer");
    expect(decidePhoneMove(start, { action: "next", from: "user2", at: start }).ok).toBe(false);
    expect(decidePhoneMove(0, { action: "next", from: "organizer", at: 0 }).ok).toBe(false);
  });

  it("hands over to the next person from the last beat of an act", () => {
    const last = lastOf("organizer");
    expect(decidePhoneMove(last, { action: "next", from: "organizer", at: last })).toEqual({ ok: true, index: last + 1 });
    expect(phoneView(last + 1, "organizer").kind).toBe("waiting");
    // Once handed over, the organizer can no longer move it.
    expect(decidePhoneMove(last + 1, { action: "back", from: "organizer", at: last + 1 }).ok).toBe(false);
  });

  it("keeps Back inside the person's own act", () => {
    const start = firstOf("user2");
    expect(decidePhoneMove(start, { action: "back", from: "user2", at: start }).ok).toBe(false);
    expect(decidePhoneMove(start + 1, { action: "back", from: "user2", at: start + 1 })).toEqual({ ok: true, index: start });
  });

  it("lets the next person start their own act once the act before rests on its last beat", () => {
    // Jing to Jolyn, Jolyn to Lisa, Lisa to Trish.
    const joins: [CastId, CastId][] = [["organizer", "user1"], ["user1", "user2"], ["user2", "user3"]];
    for (const [before, after] of joins) {
      const last = lastOf(before);
      expect(canJoinAt(last, after)).toBe(true);
      expect(phoneView(last, after)).toMatchObject({ kind: "waiting", upNext: true, canJoin: true });
      expect(decidePhoneMove(last, { action: "join", from: after, at: last })).toEqual({ ok: true, index: last + 1 });
      // Not before the last beat, not for anyone else, and only once.
      expect(decidePhoneMove(last - 1, { action: "join", from: after, at: last - 1 }).ok).toBe(false);
      expect(decidePhoneMove(last, { action: "join", from: before, at: last }).ok).toBe(false);
      expect(decidePhoneMove(last + 1, { action: "join", from: after, at: last })).toEqual({ ok: false, reason: "The stage has already moved" });
      // The person on now still hands over with Next.
      expect(decidePhoneMove(last, { action: "next", from: before, at: last })).toEqual({ ok: true, index: last + 1 });
    }
    // Nobody joins from the pitch beats (Jing starts from the laptop), or past the last act.
    expect(canJoinAt(firstOf("organizer") - 1, "organizer")).toBe(false);
    expect(canJoinAt(lastOf("user3"), "user1")).toBe(false);
  });

  it("lets a screen of the person on now pass the show to the next person's first beat", () => {
    // Lisa's "Open to company" on any of her beats goes to Trish's first beat; Jolyn's "Sent to Lisa" to Lisa's.
    for (const [cast, next] of [["user2", "user3"], ["user1", "user2"]] as [CastId, CastId][]) {
      for (let beat = firstOf(cast); beat <= lastOf(cast); beat += 1) {
        expect(decidePhoneMove(beat, { action: "pass", from: cast, at: beat })).toEqual({ ok: true, index: firstOf(next) });
      }
      expect(decidePhoneMove(firstOf(cast), { action: "pass", from: next, at: firstOf(cast) }).ok).toBe(false);
    }
    expect(nextActStart(lastOf("user3"))).toBeNull();
    expect(decidePhoneMove(lastOf("user3"), { action: "pass", from: "user3", at: lastOf("user3") }).ok).toBe(false);
  });

  it("does nothing twice: a tap from a beat the stage has left is refused", () => {
    const start = firstOf("organizer");
    expect(decidePhoneMove(start + 1, { action: "next", from: "organizer", at: start })).toEqual({ ok: false, reason: "The stage has already moved" });
  });
});

describe("what a presenter phone shows", () => {
  it("waits before the show, says who is next, and wraps up after", () => {
    expect(phoneView(0, "organizer")).toMatchObject({ kind: "waiting", phase: "before", upNext: true });
    expect(phoneView(0, "user2")).toMatchObject({ kind: "waiting", upNext: false });
    expect(phoneView(lastOf("organizer"), "user1")).toMatchObject({ kind: "waiting", onNow: "organizer", upNext: true });
    expect(phoneView(BEATS.length - 1, "user3")).toMatchObject({ kind: "waiting", phase: "after" });
  });

  it("marks the last beat of an act with who it hands to", () => {
    expect(phoneView(lastOf("user1"), "user1")).toMatchObject({ kind: "scene", lastOfAct: true, handsTo: "user2" });
    expect(nextCast(lastOf("user2"))).toBe("user3");
  });

  it("continues U1c inside the walk already on screen, otherwise loads it", () => {
    const context = { storyEventId: "e1", now: new Date("2026-11-13T20:05:00Z") };
    const u1b = BEATS[at("U1b")]!;
    const u1c = BEATS[at("U1c")]!;
    expect(inFrameMessage(u1c, u1b.path!(context), context)).toMatchObject({ type: "demo-ask" });
    expect(inFrameMessage(u1c, "/somewhere-else", context)).toBeNull();
  });

  it("reads each personal link", () => {
    expect(castFromSlug("Jing")).toBe("organizer");
    expect(castFromSlug("nobody")).toBeNull();
  });
});

describe("Lisa's invite steps", () => {
  it("continue in place from the step before, and load the page any other way in", () => {
    const context = { storyEventId: "e1", now: new Date("2026-11-13T20:05:00Z") };
    const pairs: [string, string, string][] = [["U2b", "U2c", "account"], ["U2c", "U2d", "ready"], ["U2d", "U2e", "event"], ["U2e", "U2f", "joined"]];
    for (const [from, to, step] of pairs) {
      const before = BEATS[at(from)]!;
      const beat = BEATS[at(to)]!;
      expect(inFrameMessage(beat, before.path!(context), context)).toEqual({ type: "demo-step", step });
      expect(inFrameMessage(beat, "/demo/instagram/dm", context)).toBeNull();
    }
  });
});
