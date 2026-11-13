import "server-only";

// One server log line per slow demo request, with where its time went (store reads,
// waiting on Muse, waiting on a shared answer), so a slow beat on the stage can be
// read back from the logs: `[legs] <route> {"store":12,"muse":3105,"total":3130}`.

export type LegTimer = {
  /** Time since the previous mark (or the start), under `label`. */
  mark: (label: string) => void;
  /** Logs the marks, the total, and any extra facts. */
  done: (extra?: Record<string, unknown>) => void;
};

export function legTimer(route: string): LegTimer {
  const startedAt = performance.now();
  let last = startedAt;
  const marks: Record<string, unknown> = {};
  return {
    mark(label) {
      const now = performance.now();
      marks[label] = Math.round(now - last);
      last = now;
    },
    done(extra = {}) {
      console.info(`[legs] ${route} ${JSON.stringify({ ...marks, total: Math.round(performance.now() - startedAt), ...extra })}`);
    },
  };
}
