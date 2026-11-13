import "server-only";
import { z } from "zod";
import { readStagePosition } from "@/lib/demo/stage-position";
import { loadState, saveState } from "@/lib/store/state";

// The request a presenter really made on the Muse card in this run (spoken on the
// laptop, spoken on their phone, or typed), with Muse's exact answer, one record
// per viewer. U1b and U1c are the same screen: when it reloads (Back then Next, a
// jump, a phone reload) or the stage moves on to "Change of plans", the card shows
// this record instead of asking again, so the words never change between beats.
// The stage's frame and the presenter's phone read the same record, so both show
// the same words. Per viewer, so Trish's card never shows Jolyn's words, and per
// run: the demo reset (lib/demo/reset.ts) clears it.

export const SAID_PREFIX = "demo-said:";
// Muse's answer as the card draws it; the card owns its shape, the store keeps it whole.
const MAX_VIEW_BYTES = 60_000;

export const SaidRecordSchema = z.object({
  text: z.string().trim().min(1).max(600),
  by: z.enum(["voice", "typed"]),
  view: z.record(z.string(), z.unknown()),
  at: z.string().optional(),
  // The run it was said in (lib/demo/run.ts). A record from another run is never shown.
  run: z.string().optional(),
});
export type SaidRecord = z.infer<typeof SaidRecordSchema>;

const memory = globalThis as typeof globalThis & { __demoSaid?: Map<string, SaidRecord> };
const remembered = () => (memory.__demoSaid ??= new Map());

export function viewFits(record: SaidRecord): boolean {
  return JSON.stringify(record.view).length <= MAX_VIEW_BYTES;
}

/** The record when it belongs to `run` (or there is no run yet), else null. */
export function sameRun(record: SaidRecord | null | undefined, run: string | null | undefined): SaidRecord | null {
  if (!record) return null;
  if (!run) return record;
  return record.run === run ? record : null;
}

export async function readSaid(viewerId: string): Promise<SaidRecord | null> {
  const run = (await readStagePosition())?.run;
  const stored = sameRun(await loadState(`${SAID_PREFIX}${viewerId}`, SaidRecordSchema), run);
  return stored ?? sameRun(remembered().get(viewerId), run);
}

export async function writeSaid(viewerId: string, record: SaidRecord, now = new Date()): Promise<SaidRecord> {
  const run = (await readStagePosition())?.run;
  const stored = { ...record, at: now.toISOString(), ...(run ? { run } : {}) };
  remembered().set(viewerId, stored);
  await saveState(`${SAID_PREFIX}${viewerId}`, stored);
  return stored;
}

/** This server instance's copies; the stored ones go by prefix in the demo reset. */
export function resetSaid(): void {
  remembered().clear();
}
