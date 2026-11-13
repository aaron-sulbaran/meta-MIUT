import { beatCast } from "@/lib/demo/beat-context";
import { BEATS } from "@/lib/demo/beats";

// How often a screen asks where the /demo stage is (GET /api/demo/stage). Every
// ask is a function call and, at most every few hundred ms per server instance,
// a Redis command on a small shared plan, so screens ask only as often as the
// moment needs: fast while the skit is moving, slow when it is quiet or on the
// opening and closing beats, never while the tab is hidden. A key, a tap, or the
// tab showing again asks at once and counts as activity. Client safe.

export const FAST_POLL_MS = 250;
// Quiet beats still ask every second, so a fresh run reaches every screen within a second or two.
export const SLOW_POLL_MS = 1_000;
// Fast polling lasts this long after the last move or touch.
export const QUIET_AFTER_MS = 3 * 60_000;

/** Milliseconds until the next ask, or null to stop until the tab shows again. */
export function pollDelay({ hidden, index, lastActivityAt, now }: { hidden: boolean; index: number | null; lastActivityAt: number; now: number }): number | null {
  if (hidden) return null;
  if (index !== null && beatCast(BEATS[index]) === null) return SLOW_POLL_MS;
  return now - lastActivityAt < QUIET_AFTER_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}

export type StagePoll = {
  /** Something moved here (a local move): poll fast again and ask now. */
  active: () => void;
  stop: () => void;
};

/**
 * Asks `read` on the schedule above; `read` fetches the position, handles it, and
 * returns the stage's beat (or null). A new beat counts as activity.
 */
export function startStagePoll(read: () => Promise<number | null>): StagePoll {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastActivityAt = Date.now();
  let lastIndex: number | null = null;
  let running = false;

  async function tick() {
    if (stopped || running) return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    running = true;
    const index = await read().catch(() => null);
    running = false;
    if (stopped) return;
    if (index !== null && index !== lastIndex) {
      if (lastIndex !== null) lastActivityAt = Date.now();
      lastIndex = index;
    }
    const delay = pollDelay({ hidden: document.hidden, index: lastIndex, lastActivityAt, now: Date.now() });
    if (delay !== null) timer = setTimeout(tick, delay);
  }

  const wake = () => {
    lastActivityAt = Date.now();
    void tick();
  };
  const onVisible = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("keydown", wake);
  window.addEventListener("pointerdown", wake);
  void tick();

  return {
    active: wake,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("pointerdown", wake);
    },
  };
}
