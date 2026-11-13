import { describe, expect, it } from "vitest";
import { StageMoveSchema, applyMove } from "@/lib/demo/stage-position";

const NOW = new Date("2026-11-13T15:00:00Z");

describe("the stage position", () => {
  it("moves next and back from where it is, inside the beats", () => {
    const at7 = applyMove(null, { action: "goto", index: 7 }, 16, NOW);
    expect(at7.index).toBe(7);
    expect(applyMove(at7, { action: "next" }, 16, NOW).index).toBe(8);
    expect(applyMove(at7, { action: "back" }, 16, NOW).index).toBe(6);
    expect(applyMove(null, { action: "back" }, 16, NOW).index).toBe(0);
    expect(applyMove({ ...at7, index: 15 }, { action: "next" }, 16, NOW).index).toBe(15);
    expect(applyMove(null, { action: "goto", index: 99 }, 16, NOW).index).toBe(15);
  });

  it("always counts up, even for two moves in the same millisecond or after a restart", () => {
    const first = applyMove(null, { action: "next" }, 16, NOW);
    const second = applyMove(first, { action: "next" }, 16, NOW);
    expect(first.seq).toBe(NOW.getTime());
    expect(second.seq).toBe(NOW.getTime() + 1);
    // A restarted server has no record, but the clock keeps it ahead of what readers saw.
    expect(applyMove(null, { action: "next" }, 16, new Date(NOW.getTime() + 5_000)).seq).toBeGreaterThan(second.seq);
  });

  it("accepts only next, back, or a beat number", () => {
    expect(StageMoveSchema.safeParse({ action: "next" }).success).toBe(true);
    expect(StageMoveSchema.safeParse({ action: "goto", index: 3 }).success).toBe(true);
    expect(StageMoveSchema.safeParse({ action: "goto", index: -1 }).success).toBe(false);
    expect(StageMoveSchema.safeParse({ action: "reset" }).success).toBe(false);
  });
});

describe("moves from a presenter's own phone", () => {
  it("moves on its own beat once, refuses a repeat and anyone else, and the laptop always wins", async () => {
    const { setStateClient } = await import("@/lib/store/state");
    const { moveStage, movePhone, PhoneMoveSchema } = await import("@/lib/demo/stage-position");
    const { BEATS } = await import("@/lib/demo/beats");
    setStateClient(null);
    const o1 = BEATS.findIndex((beat) => beat.id === "O1");
    await moveStage({ action: "goto", index: o1 }, NOW);
    const tapped = await movePhone({ action: "next", from: "organizer", at: o1 }, new Date(NOW.getTime() + 1));
    expect(tapped).toMatchObject({ moved: true, data: { index: o1 + 1 } });
    // The same tap again (or the stage frame's copy of it) does nothing.
    expect(await movePhone({ action: "next", from: "organizer", at: o1 }, new Date(NOW.getTime() + 2))).toMatchObject({ moved: false, data: { index: o1 + 1 } });
    expect(await movePhone({ action: "next", from: "user2", at: o1 + 1 })).toMatchObject({ moved: false });
    expect((await moveStage({ action: "next" }, new Date(NOW.getTime() + 3))).index).toBe(o1 + 2);
    // The hand-over: on the last beat of Jolyn's act, Lisa starts her own act from her phone, once.
    const u1c = BEATS.findIndex((beat) => beat.id === "U1c");
    await moveStage({ action: "goto", index: u1c }, new Date(NOW.getTime() + 4));
    expect(await movePhone({ action: "join", from: "user3", at: u1c }, new Date(NOW.getTime() + 5))).toMatchObject({ moved: false });
    expect(await movePhone({ action: "join", from: "user2", at: u1c }, new Date(NOW.getTime() + 6))).toMatchObject({ moved: true, data: { index: u1c + 1 } });
    expect(await movePhone({ action: "join", from: "user2", at: u1c }, new Date(NOW.getTime() + 7))).toMatchObject({ moved: false });
    expect(PhoneMoveSchema.safeParse({ action: "join", from: "user2", at: u1c }).success).toBe(true);
    // A screen passes the show on: from Lisa's first beat straight to Trish's first beat, once, and only from Lisa.
    const u2a = u1c + 1;
    const u3a = BEATS.findIndex((beat) => beat.id === "U3a1");
    expect(await movePhone({ action: "pass", from: "user3", at: u2a }, new Date(NOW.getTime() + 8))).toMatchObject({ moved: false });
    expect(await movePhone({ action: "pass", from: "user2", at: u2a }, new Date(NOW.getTime() + 9))).toMatchObject({ moved: true, data: { index: u3a } });
    expect(await movePhone({ action: "pass", from: "user2", at: u2a }, new Date(NOW.getTime() + 10))).toMatchObject({ moved: false });
    setStateClient(undefined);
  });
});

describe("the same invite sent twice", () => {
  it("goes out once within the window, and again after it", async () => {
    const { claimOnce, resetClaims, setStateClient } = await import("@/lib/store/state");
    setStateClient(null);
    resetClaims();
    const key = "invite:sample-student:lisa:e1";
    expect(await claimOnce(key, 180, 0)).toBe(true);
    expect(await claimOnce(key, 180, 60_000)).toBe(false);
    expect(await claimOnce("invite:sample-student:lisa:e2", 180, 60_000)).toBe(true);
    expect(await claimOnce(key, 180, 181_000)).toBe(true);
    resetClaims();
    expect(await claimOnce(key, 180, 182_000)).toBe(true);
    setStateClient(undefined);
  });
});

describe("the deck step in the stage record", () => {
  it("records the step for the beat the stage is on, keeps it on the same beat, and drops it on a move", async () => {
    const { applyDeckStep, DeckStepSchema, StagePositionSchema } = await import("@/lib/demo/stage-position");
    const onDeck = applyMove(null, { action: "goto", index: 0 }, 16, NOW);
    const stepped = applyDeckStep(onDeck, { action: "deck", at: 0, name: "opening", step: 3, steps: 8 }, new Date(NOW.getTime() + 1));
    expect(stepped).toMatchObject({ index: 0, deck: { name: "opening", step: 3, steps: 8 } });
    expect(stepped!.seq).toBeGreaterThan(onDeck.seq);
    // The stage claiming its own beat again keeps the step; moving on drops it.
    expect(applyMove(stepped, { action: "goto", index: 0 }, 16, NOW).deck).toEqual(stepped!.deck);
    expect(applyMove(stepped, { action: "next" }, 16, NOW).deck).toBeUndefined();
    // A late report from a beat the stage has left does nothing.
    expect(applyDeckStep(applyMove(stepped, { action: "next" }, 16, NOW), { action: "deck", at: 0, name: "opening", step: 4 }, NOW)).toBeNull();
    // Older records with no deck still parse, and a report needs a beat, a name and a step.
    expect(StagePositionSchema.safeParse({ index: 2, seq: 1, at: NOW.toISOString() }).success).toBe(true);
    expect(DeckStepSchema.safeParse({ action: "deck", at: 0, name: "opening" }).success).toBe(false);
  });
});

describe("what a presenter's phone heard", () => {
  it("records only from the person whose beat it is, keeps it with a deck step, and drops it on a move", async () => {
    const { applyPhoneSignal, PhoneSignalSchema } = await import("@/lib/demo/stage-position");
    const { BEATS } = await import("@/lib/demo/beats");
    const u1c = BEATS.findIndex((beat) => beat.id === "U1c");
    const onBeat = applyMove(null, { action: "goto", index: u1c }, BEATS.length, NOW);
    const listening = applyPhoneSignal(onBeat, { action: "signal", from: "user1", at: u1c, kind: "listening", on: true }, new Date(NOW.getTime() + 1));
    expect(listening).toMatchObject({ ok: true, position: { index: u1c, signal: { from: "user1", kind: "listening", on: true } } });
    if (!listening.ok) return;
    expect(listening.position.seq).toBeGreaterThan(onBeat.seq);
    const said = applyPhoneSignal(listening.position, { action: "signal", from: "user1", at: u1c, kind: "said", text: "find one near Lisa" }, new Date(NOW.getTime() + 2));
    expect(said).toMatchObject({ ok: true, position: { signal: { kind: "said", text: "find one near Lisa" } } });
    expect(applyPhoneSignal(onBeat, { action: "signal", from: "user2", at: u1c, kind: "said", text: "x" }, NOW).ok).toBe(false);
    expect(applyPhoneSignal(onBeat, { action: "signal", from: "user1", at: u1c - 1, kind: "said", text: "x" }, NOW).ok).toBe(false);
    if (!said.ok) return;
    expect(applyMove(said.position, { action: "goto", index: u1c }, BEATS.length, NOW).signal).toEqual(said.position.signal);
    expect(applyMove(said.position, { action: "next" }, BEATS.length, NOW).signal).toBeUndefined();
    expect(PhoneSignalSchema.safeParse({ action: "signal", from: "user1", at: 0, kind: "shouted" }).success).toBe(false);
    // Hearing failed on her phone: recorded with the line it showed, so the stage stops Listening.
    const failed = applyPhoneSignal(said.position, { action: "signal", from: "user1", at: u1c, kind: "failed", text: "I couldn't hear that." }, new Date(NOW.getTime() + 3));
    expect(failed).toMatchObject({ ok: true, position: { signal: { kind: "failed", text: "I couldn't hear that." } } });
  });
});
