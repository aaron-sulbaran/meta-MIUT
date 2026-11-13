import "server-only";
import { z } from "zod";
import { BEATS } from "@/lib/demo/beats";
import { loadState, saveState } from "@/lib/store/state";

// Where the /demo stage is: one small record (its beat) in the shared store, so
// a phone remote (/demo/remote) can move the show and the laptop stage follows
// within about a second. The laptop is the master and never waits on this: if
// the store or the network fails, the stage keeps running on its own.
//
// Without Redis the record lives in this server process, which is enough for
// the laptop alone or a phone on the laptop's dev server. On Vercel, phones and
// the laptop reach different instances, so the remote needs Redis there.
//
// Not cleared by the demo reset on purpose: the reset sends the stage to the
// first beat, which writes a new record anyway.

export const StagePositionSchema = z.object({
  index: z.number().int().min(0),
  // Grows with every move and across restarts (it starts from the clock), so a
  // reader acts only on moves newer than the last one it saw.
  seq: z.number().int(),
  at: z.string(),
});
export type StagePosition = z.infer<typeof StagePositionSchema>;

export const StageMoveSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), index: z.number().int().min(0) }),
  z.object({ action: z.literal("next") }),
  z.object({ action: z.literal("back") }),
]);
export type StageMove = z.infer<typeof StageMoveSchema>;

const STATE_NAME = "demo-stage";
const memory = globalThis as typeof globalThis & { __demoStagePosition?: StagePosition };

/** The position after a move, clamped to the beats that exist. */
export function applyMove(current: StagePosition | null, move: StageMove, beatCount: number, now: Date): StagePosition {
  const from = current?.index ?? 0;
  const wanted = move.action === "goto" ? move.index : move.action === "next" ? from + 1 : from - 1;
  return {
    index: Math.max(0, Math.min(beatCount - 1, wanted)),
    seq: Math.max(now.getTime(), (current?.seq ?? 0) + 1),
    at: now.toISOString(),
  };
}

export async function readStagePosition(): Promise<StagePosition | null> {
  return (await loadState(STATE_NAME, StagePositionSchema)) ?? memory.__demoStagePosition ?? null;
}

export async function moveStage(move: StageMove, now = new Date()): Promise<StagePosition> {
  const next = applyMove(await readStagePosition(), move, BEATS.length, now);
  memory.__demoStagePosition = next;
  await saveState(STATE_NAME, next);
  return next;
}
