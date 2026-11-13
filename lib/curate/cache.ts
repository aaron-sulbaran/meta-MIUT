import "server-only";
import { z } from "zod";
import { claimOnce, loadState, saveState } from "@/lib/store/state";

// One curate answer per viewer for a couple of minutes, so the /demo stage and the
// presenter's phone (each loads the screen and asks) show the same picks. The first
// reader runs the real Muse call; whoever asks second gets that live answer. Kept in
// this process and in the shared store (Redis), cleared by the demo reset.

export const CURATE_CACHE_MS = 2 * 60_000;
const WAIT_FOR_FIRST_MS = 20_000;
const POLL_MS = 400;

const Cached = z.object({ at: z.number(), body: z.unknown() });
type Cached = z.infer<typeof Cached>;

const memory = globalThis as typeof globalThis & { __curateCache?: Map<string, { at: number; body: Promise<unknown> }> };
const cacheName = (viewerId: string) => `curate-cache:${viewerId}`;
const fresh = (at: number, now: number) => now - at < CURATE_CACHE_MS;

/** Forgets this process's cached answers (the demo reset; the stored copies go with their prefix). */
export function resetCurateCache(): void {
  memory.__curateCache?.clear();
}

/** The cached answer for this viewer, or `run()`'s, which is then cached. */
export async function cachedCurate(
  viewerId: string,
  run: () => Promise<unknown>,
  now = Date.now(),
  keep: (value: unknown) => boolean = (value) => (value as { data?: unknown } | null)?.data != null,
): Promise<unknown> {
  const local = (memory.__curateCache ??= new Map());
  const held = local.get(viewerId);
  if (held && fresh(held.at, now)) return held.body;

  const stored = await loadState(cacheName(viewerId), Cached);
  if (stored && fresh(stored.at, now)) return stored.body;

  // Another instance is already asking Muse: wait for its answer instead of asking twice.
  if (!(await claimOnce(cacheName(viewerId), 30, now))) {
    const until = Date.now() + WAIT_FOR_FIRST_MS;
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const inProcess = local.get(viewerId);
      if (inProcess && fresh(inProcess.at, now)) return inProcess.body;
      const first: Cached | null = await loadState(cacheName(viewerId), Cached);
      if (first && fresh(first.at, now)) return first.body;
    }
  }

  const body = run();
  local.set(viewerId, { at: now, body });
  const value = await body.catch((error: unknown) => {
    local.delete(viewerId);
    throw error;
  });
  // A failed answer is not kept: the next reader asks again.
  if (!keep(value)) local.delete(viewerId);
  else await saveState(cacheName(viewerId), { at: now, body: value });
  return value;
}
