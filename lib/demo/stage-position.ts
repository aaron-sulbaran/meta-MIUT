import "server-only";
import { z } from "zod";
import { PHONE_CAST, beatCast, decidePhoneMove, type PhoneMove } from "@/lib/demo/beat-context";
import { BEATS, type CastId } from "@/lib/demo/beats";
import { loadState, noteRun, saveState } from "@/lib/store/state";
import { newRunId } from "@/lib/demo/run";

// Where the /demo stage is: one small record (its beat) in the shared store, so
// a phone remote (/demo/remote) can move the show and the laptop stage follows
// within about a second. The laptop is the master and never waits on this: if
// the store or the network fails, the stage keeps running on its own.
//
// Without Redis the record lives in this server process, which is enough for
// the laptop alone or a phone on the laptop's dev server. On Vercel, phones and
// the laptop reach different instances, so the remote needs Redis there.
//
// The record also names the run (lib/demo/run.ts): a fresh run (the demo reset)
// writes a new record on the first beat with a new run id, and every screen that
// sees the id change starts over. Moves keep the run they were made in.

export const StagePositionSchema = z.object({
  index: z.number().int().min(0),
  // Grows with every move and across restarts (it starts from the clock), so a
  // reader acts only on moves newer than the last one it saw.
  seq: z.number().int(),
  at: z.string(),
  // The run this record belongs to, when it started, the last real move (not a deck
  // step or a phone signal), and the furthest beat reached, for the stale-run warning.
  // Optional, so records from before runs still parse (they read as an old run).
  run: z.string().optional(),
  runAt: z.string().optional(),
  movedAt: z.string().optional(),
  furthest: z.number().int().min(0).optional(),
  // Who made the last beat move: "stage" (a /demo stage tab's own goto: a stage that
  // follows applies it as a beat move) or "control" (the remote's Next and Back, a
  // presenter phone: a stage on a deck or film steps it first). Missing reads as "control".
  by: z.enum(["stage", "control"]).optional(),
  // The last control move (the remote's Next or Back, a phone): its seq and the beats it went
  // from and to. Kept after a stage puts the record back (it stepped a deck instead), so every
  // other stage still sees that move once and steps its own deck too.
  control: z.object({ seq: z.number().int(), from: z.number().int().min(0), to: z.number().int().min(0) }).optional(),
  // The step a deck beat is on (the stage reports it from the deck's "step"
  // message), so a phone can show that step's presenter notes. Belongs to beat
  // `index` only: any move drops it. Optional, so older records still parse.
  deck: z.object({ name: z.string().min(1).max(64), step: z.number().int().min(0), steps: z.number().int().min(1).optional() }).nullish(),
  // The latest thing a presenter's phone heard on their beat (U1c: the mic opened
  // or closed, the transcript came back, or hearing failed with the line it showed),
  // so the stage can mirror it live and never sits on Listening.
  // Belongs to beat `index` only: any move to another beat drops it.
  signal: z
    .object({
      from: z.string(),
      kind: z.enum(["listening", "said", "failed"]),
      on: z.boolean().optional(),
      text: z.string().max(600).optional(),
      at: z.string(),
    })
    .nullish(),
});
export type StagePosition = z.infer<typeof StagePositionSchema>;
export type MoveBy = NonNullable<StagePosition["by"]>;

export const StageMoveSchema = z.discriminatedUnion("action", [
  // `undo`: a stage putting the record back after it stepped a deck for the remote's move to
  // beat `undo`. Applied only while the record still sits on that move, so a late or second
  // stage's undo never pulls back a move made since.
  z.object({ action: z.literal("goto"), index: z.number().int().min(0), undo: z.number().int().min(0).optional() }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("back") }),
]);
export type StageMove = z.infer<typeof StageMoveSchema>;

// The stage reports the deck step on screen: { action: "deck", at, name, step, steps? }.
// `at` is the beat the stage is on, so a late report after a move does nothing.
export const DeckStepSchema = z.object({
  action: z.literal("deck"),
  at: z.number().int().min(0),
  name: z.string().min(1).max(64),
  step: z.number().int().min(0),
  steps: z.number().int().min(1).optional(),
});
export type DeckStep = z.infer<typeof DeckStepSchema>;

// A presenter phone reports what its screen heard: { action: "signal", from, at, kind, on?, text? }.
// Only the person whose beat `at` is, while the stage is still on it.
export const PhoneSignalSchema = z.object({
  action: z.literal("signal"),
  from: z.enum(PHONE_CAST as [CastId, ...CastId[]]),
  at: z.number().int().min(0),
  kind: z.enum(["listening", "said", "failed"]),
  on: z.boolean().optional(),
  text: z.string().max(600).optional(),
});
export type PhoneSignal = z.infer<typeof PhoneSignalSchema>;

/** The position with the phone's signal recorded, or a reason it is refused. */
export function applyPhoneSignal(
  current: StagePosition | null,
  report: PhoneSignal,
  now: Date,
): { ok: true; position: StagePosition } | { ok: false; reason: string } {
  const index = current?.index ?? 0;
  if (index !== report.at) return { ok: false, reason: "The stage has already moved" };
  if (beatCast(BEATS[index]) !== report.from) return { ok: false, reason: "It is not your beat" };
  return {
    ok: true,
    position: {
      ...(current ?? { index, at: now.toISOString(), seq: 0 }),
      seq: Math.max(now.getTime(), (current?.seq ?? 0) + 1),
      at: now.toISOString(),
      signal: {
        from: report.from,
        kind: report.kind,
        ...(report.on !== undefined ? { on: report.on } : {}),
        ...(report.text !== undefined ? { text: report.text } : {}),
        at: now.toISOString(),
      },
    },
  };
}

export async function reportPhoneSignal(report: PhoneSignal, now = new Date()) {
  const current = await readStored();
  const result = applyPhoneSignal(current, report, now);
  if (!result.ok) return { data: current, recorded: false as const, reason: result.reason };
  return { data: await savePosition(result.position), recorded: true as const };
}

/** The position with the deck step recorded, or null when the stage is no longer on beat `at`. */
export function applyDeckStep(current: StagePosition | null, report: DeckStep, now: Date): StagePosition | null {
  if ((current?.index ?? 0) !== report.at) return null;
  return {
    ...runFields(current, report.at, now, false),
    index: report.at,
    seq: Math.max(now.getTime(), (current?.seq ?? 0) + 1),
    at: now.toISOString(),
    ...(current?.by ? { by: current.by } : {}),
    ...(current?.control ? { control: current.control } : {}),
    deck: { name: report.name, step: report.step, ...(report.steps ? { steps: report.steps } : {}) },
    ...(current?.signal ? { signal: current.signal } : {}),
  };
}

const STATE_NAME = "demo-stage";

/** The run fields a new record carries over: same run, and (for a real move) the move's time and furthest beat. */
function runFields(current: StagePosition | null, index: number, now: Date, moved: boolean) {
  const run = current?.run ?? newRunId(now);
  const runAt = current?.runAt ?? now.toISOString();
  const movedAt = moved ? now.toISOString() : (current?.movedAt ?? current?.at ?? now.toISOString());
  const furthest = Math.max(current?.furthest ?? current?.index ?? 0, moved ? index : 0);
  return { run, runAt, movedAt, furthest };
}
const memory = globalThis as typeof globalThis & { __demoStagePosition?: StagePosition };

/** The control field after a move: a control move records itself; a stage move keeps the last one. */
function controlAfter(current: StagePosition | null, by: MoveBy, index: number, seq: number) {
  if (by === "control") return { control: { seq, from: current?.index ?? 0, to: index } };
  return current?.control ? { control: current.control } : {};
}

/** The position after a move, clamped to the beats that exist. A deck step stays only while the beat does. */
export function applyMove(
  current: StagePosition | null,
  move: StageMove,
  beatCount: number,
  now: Date,
  by: MoveBy = move.action === "goto" ? "stage" : "control",
): StagePosition {
  const from = current?.index ?? 0;
  const wanted = move.action === "goto" ? move.index : move.action === "next" ? from + 1 : from - 1;
  const index = Math.max(0, Math.min(beatCount - 1, wanted));
  const seq = Math.max(now.getTime(), (current?.seq ?? 0) + 1);
  return {
    ...runFields(current, index, now, true),
    index,
    seq,
    at: now.toISOString(),
    by,
    ...controlAfter(current, by, index, seq),
    ...(current?.deck && current.index === index ? { deck: current.deck } : {}),
    ...(current?.signal && current.index === index ? { signal: current.signal } : {}),
  };
}

// The stage, the remote, and every presenter phone poll this (lib/demo/stage-poll.ts).
// Readers on the same server instance share one store read for READ_SHARE_MS
// (concurrent readers wait on the same read), so Redis sees at most four reads a
// second per instance however many screens are open. A move on this instance
// updates the shared copy at once, so its readers see it with no wait.
export const READ_SHARE_MS = 250;
const shared = globalThis as typeof globalThis & { __demoStageRead?: { at: number; value: Promise<StagePosition | null> } };

async function readStored(): Promise<StagePosition | null> {
  return (await loadState(STATE_NAME, StagePositionSchema)) ?? memory.__demoStagePosition ?? null;
}

export async function readStagePosition(now = Date.now()): Promise<StagePosition | null> {
  const recent = shared.__demoStageRead;
  if (recent && now - recent.at < READ_SHARE_MS) return recent.value;
  const value = readStored();
  shared.__demoStageRead = { at: now, value };
  return value;
}

async function savePosition(next: StagePosition): Promise<StagePosition> {
  memory.__demoStagePosition = next;
  shared.__demoStageRead = { at: Date.now(), value: Promise.resolve(next) };
  await saveState(STATE_NAME, next);
  return next;
}

export async function reportDeckStep(report: DeckStep, now = new Date()): Promise<{ data: StagePosition; recorded: boolean }> {
  const current = await readStored();
  const next = applyDeckStep(current, report, now);
  if (!next) return { data: current ?? applyMove(null, { action: "goto", index: 0 }, BEATS.length, now), recorded: false };
  return { data: await savePosition(next), recorded: true };
}

/**
 * A fresh run: a new record on the first beat with a new run id, so every stage,
 * phone, remote and console sees the id change and starts over (lib/demo/reset.ts).
 */
export async function startRun(now = new Date()): Promise<StagePosition> {
  const current = await readStored();
  const run = newRunId(now);
  noteRun(run);
  return savePosition({
    index: 0,
    seq: Math.max(now.getTime(), (current?.seq ?? 0) + 1),
    at: now.toISOString(),
    run,
    runAt: now.toISOString(),
    movedAt: now.toISOString(),
    furthest: 0,
  });
}

/** Forgets this instance's phone check-ins (a fresh run; the stored ones go by prefix). */
export function resetPhonesSeen(): void {
  stamps.__demoPhoneSeen = {};
}

/** True when a stage's undo (see StageMoveSchema) still applies to the record. */
export function undoApplies(current: StagePosition | null, undo: number): boolean {
  return current !== null && current.index === undo && current.by !== "stage";
}

export async function moveStage(move: StageMove, now = new Date()): Promise<StagePosition> {
  const current = await readStored();
  if (move.action === "goto" && move.undo !== undefined && !undoApplies(current, move.undo)) {
    return current ?? applyMove(null, { action: "goto", index: move.index }, BEATS.length, now);
  }
  return savePosition(applyMove(current, move, BEATS.length, now));
}

// A presenter's own phone (/demo/phone/<slug>): it moves the stage only on its
// own beats ("pass" from any of them skips to the next person's first beat), or "join" to start their own act once the act before theirs rests on
// its last beat (lib/demo/beat-context.ts decidePhoneMove), and says which beat it
// saw, so a repeated tap never moves the stage twice. The laptop and the remote
// use moveStage, which always wins.
export const PhoneMoveSchema = z.object({
  action: z.enum(["next", "back", "join", "pass"]),
  from: z.enum(PHONE_CAST as [CastId, ...CastId[]]),
  at: z.number().int().min(0),
});

export async function movePhone(
  move: PhoneMove,
  now = new Date(),
): Promise<{ data: StagePosition; moved: true } | { data: StagePosition | null; moved: false; reason: string }> {
  const current = await readStored();
  const decision = decidePhoneMove(current?.index ?? 0, move);
  if (!decision.ok) return { data: current, moved: false, reason: decision.reason };
  return { data: await savePosition(applyMove(current, { action: "goto", index: decision.index }, BEATS.length, now, "control")), moved: true };
}

// Which presenter phones are open: each phone's polls stamp it, at most every
// PHONE_STAMP_MS per server instance, one small record per phone so phones never
// overwrite each other. The console shows a phone as connected while its stamp is fresh.
const PHONE_STAMP_MS = 15_000;
export const PHONE_CONNECTED_MS = 40_000;
const PhoneSeenSchema = z.object({ at: z.string() });
const stamps = globalThis as typeof globalThis & { __demoPhoneSeen?: Partial<Record<CastId, string>> };
export const PHONE_SEEN_PREFIX = "demo-phone-seen:";
const phoneState = (cast: CastId) => `${PHONE_SEEN_PREFIX}${cast}`;

export async function stampPhone(cast: CastId, now = new Date()): Promise<void> {
  const seen = (stamps.__demoPhoneSeen ??= {});
  const last = seen[cast];
  if (last && now.getTime() - Date.parse(last) < PHONE_STAMP_MS) return;
  seen[cast] = now.toISOString();
  await saveState(phoneState(cast), { at: seen[cast] });
}

/** When each presenter phone last checked in (ISO), or null if never. */
export async function readPhonesSeen(): Promise<Record<CastId, string | null>> {
  const entries = await Promise.all(
    PHONE_CAST.map(async (cast) => {
      const stored = await loadState(phoneState(cast), PhoneSeenSchema);
      const local = stamps.__demoPhoneSeen?.[cast] ?? null;
      const at = [stored?.at ?? null, local].filter((value): value is string => value !== null).sort().at(-1) ?? null;
      return [cast, at] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<CastId, string | null>;
}
