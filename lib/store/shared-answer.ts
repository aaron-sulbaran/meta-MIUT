import "server-only";
import { z } from "zod";
import { claimOnce, loadState, saveState } from "@/lib/store/state";

// One answer per name for a couple of minutes, so the /demo stage and a presenter's
// phone (each loads the same screen and asks Muse) show the same thing. The first
// reader runs the real call; whoever asks second gets that live answer, and one who
// asks while the first is still running waits for it. Kept in this process and in the
// shared store (Redis), cleared by the demo reset. Failed answers are never kept.

export const SHARED_ANSWER_MS = 2 * 60_000;
export const SHARED_ANSWER_PREFIX = "shared-answer:";
const WAIT_FOR_FIRST_MS = 20_000;
const POLL_MS = 400;

const Stored = z.object({ at: z.number(), body: z.unknown() });

const memory = globalThis as typeof globalThis & { __sharedAnswers?: Map<string, { at: number; body: Promise<unknown> }> };
const stateName = (name: string) => `${SHARED_ANSWER_PREFIX}${name}`;
const fresh = (at: number, now: number) => now - at < SHARED_ANSWER_MS;

/** Forgets this process's answers (the demo reset; the stored copies go with their prefix). */
export function resetSharedAnswers(): void {
  memory.__sharedAnswers?.clear();
}

/** The shared answer for `name`, or `run()`'s, which is then shared. */
export async function sharedAnswer(
  name: string,
  run: () => Promise<unknown>,
  now = Date.now(),
  keep: (value: unknown) => boolean = (value) => (value as { data?: unknown } | null)?.data != null,
): Promise<unknown> {
  const local = (memory.__sharedAnswers ??= new Map());
  const held = local.get(name);
  if (held && fresh(held.at, now)) return held.body;

  const stored = await loadState(stateName(name), Stored);
  if (stored && fresh(stored.at, now)) return stored.body;

  if (!(await claimOnce(stateName(name), 30, now))) {
    const until = Date.now() + WAIT_FOR_FIRST_MS;
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const inProcess = local.get(name);
      if (inProcess && fresh(inProcess.at, now)) return inProcess.body;
      const first = await loadState(stateName(name), Stored);
      if (first && fresh(first.at, now)) return first.body;
    }
  }

  const body = run();
  local.set(name, { at: now, body });
  const value = await body.catch((error: unknown) => {
    local.delete(name);
    throw error;
  });
  if (!keep(value)) local.delete(name);
  else await saveState(stateName(name), { at: now, body: value });
  return value;
}
