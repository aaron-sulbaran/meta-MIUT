import "server-only";
import { SHARED_ANSWER_MS, resetSharedAnswers, sharedAnswer } from "@/lib/store/shared-answer";

// One curate answer per viewer for a couple of minutes (lib/store/shared-answer.ts), so
// the /demo stage and the presenter's phone show the same picks. The first reader runs
// the real Muse call; whoever asks second gets that live answer.

export const CURATE_CACHE_MS = SHARED_ANSWER_MS;

/** Forgets this process's shared answers (the demo reset). */
export const resetCurateCache = resetSharedAnswers;

/** The cached answer for this viewer, or `run()`'s, which is then cached. */
export function cachedCurate(viewerId: string, run: () => Promise<unknown>, now = Date.now(), keep?: (value: unknown) => boolean): Promise<unknown> {
  return sharedAnswer(`curate:${viewerId}`, run, now, keep);
}
