import { describe, expect, it } from "vitest";
import { castFromSlug, decidePhoneMove, inFrameMessage, nextCast, phoneView } from "@/lib/demo/beat-context";
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
