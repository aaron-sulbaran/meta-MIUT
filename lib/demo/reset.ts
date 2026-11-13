import "server-only";
import { getAlertFeed } from "@/lib/alerts/feed";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore, type StoreResult } from "@/lib/events/store";
import { PICKS_PREFIX } from "@/lib/muse/rank";
import { CURATE_PICKS_PREFIX } from "@/lib/curate/picks";
import { SAID_PREFIX } from "@/lib/demo/said";
import { HEAD_START_PREFIX } from "@/lib/demo/head-start";
import { clearInstanceMemory } from "@/lib/demo/instance-memory";
import { FRESH_RUN_CLEARS } from "@/lib/demo/run";
import { PHONE_SEEN_PREFIX, resetPhonesSeen, startRun } from "@/lib/demo/stage-position";
import { STORY_PUBLISH_CLAIM } from "@/lib/events/publish";
import { deleteStatePrefixes } from "@/lib/store/state";

// The fresh run (lib/demo/run.ts). One reset for the whole demo, every persona at once: fresh seed events with
// times relative to now, no alerts, nobody going or interested, no comments or
// hellos, and Muse's memory, Ask history, and sent nearby alerts back to the
// start. Stored values go by name prefix, so a new persona or event needs no
// change here. A module that adds saved state adds its prefix below.

export const DEMO_STATE_PREFIXES = [
  "muse-signals:",
  "muse-turns:",
  "muse-nearby-sent:",
  "social-going:",
  "social-comments:",
  "social-hellos",
  // Answers the stage and a phone share (curate, who to go with): lib/store/shared-answer.ts.
  "shared-answer:",
  "claim:shared-answer:",
  // One hello written per person per event, whichever screen asks (app/api/social/hello).
  "claim:hello-write:",
  // The demo's slow live answers the stage asked for early, and the budget's recorded ones (lib/demo/head-start.ts).
  HEAD_START_PREFIX,
  `claim:${HEAD_START_PREFIX}`,
  // The Top 3 shared across server instances (lib/muse/rank.ts).
  PICKS_PREFIX,
  // Invites already sent (app/api/social/invites dedupe), so a rehearsal right after a reset sends again.
  "claim:invite:",
  // What a presenter said on the Muse card and Muse's answer (lib/demo/said.ts), kept per run.
  SAID_PREFIX,
  // Which presenter phones checked in (lib/demo/stage-position.ts), so the console counts this run's phones only.
  PHONE_SEEN_PREFIX,
  // The story event's one publish alert per run (lib/events/publish.ts).
  `claim:${STORY_PUBLISH_CLAIM}`,
  // A viewer's own first-visit picks, the Events list's Top 3 for them (lib/curate/picks.ts).
  CURATE_PICKS_PREFIX,
] as const;

export type DemoResetSummary = { events: number; clearedState: number; run: string; cleared: readonly string[] };

export async function resetDemo(now = new Date()): Promise<StoreResult<DemoResetSummary>> {
  const reseeded = await getEventStore().resetToSeed(now);
  if (reseeded.error !== null) return reseeded;
  const alerts = await getAlertFeed().clear();
  if (alerts.error !== null) return alerts;
  const attendance = await getAttendanceStore().clearAll();
  if (attendance.error !== null) return attendance;
  const cleared = await deleteStatePrefixes([...DEMO_STATE_PREFIXES]);
  if (cleared.error !== null) return cleared;

  // What this server instance holds in memory; the stored copies went above. Every
  // other instance drops its copies when it sees the new run (lib/store/state.ts followRun).
  clearInstanceMemory();
  resetPhonesSeen();

  // Last, the new run: the stage record goes to the first beat with a new run id
  // (its deck step and phone signal go with the old record), and every open screen
  // starts over when it sees the id change.
  const position = await startRun(now);

  return {
    data: { events: reseeded.data, clearedState: cleared.data, run: position.run ?? "", cleared: FRESH_RUN_CLEARS },
    error: null,
  };
}
