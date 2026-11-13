import "server-only";
import { getAlertFeed } from "@/lib/alerts/feed";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore, type StoreResult } from "@/lib/events/store";
import { resetConversations } from "@/lib/muse/conversation";
import { resetInterestMemory } from "@/lib/muse/memory";
import { resetNearbyAlerts } from "@/lib/muse/nearby";
import { PICKS_PREFIX } from "@/lib/muse/rank";
import { resetSaid, SAID_PREFIX } from "@/lib/demo/said";
import { resetCurateCache } from "@/lib/curate/cache";
import { HEAD_START_PREFIX, resetHeadStart } from "@/lib/demo/head-start";
import { resetComments } from "@/lib/social/comments";
import { resetSocial } from "@/lib/social/going";
import { deleteStatePrefixes, resetClaims } from "@/lib/store/state";

// One reset for the whole demo, every persona at once: fresh seed events with
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
] as const;

export type DemoResetSummary = { events: number; clearedState: number };

export async function resetDemo(now = new Date()): Promise<StoreResult<DemoResetSummary>> {
  const reseeded = await getEventStore().resetToSeed(now);
  if (reseeded.error !== null) return reseeded;
  const alerts = await getAlertFeed().clear();
  if (alerts.error !== null) return alerts;
  const attendance = await getAttendanceStore().clearAll();
  if (attendance.error !== null) return attendance;
  const cleared = await deleteStatePrefixes([...DEMO_STATE_PREFIXES]);
  if (cleared.error !== null) return cleared;

  // What this server instance holds in memory; the stored copies went above.
  resetInterestMemory();
  resetConversations();
  resetNearbyAlerts();
  resetSocial();
  resetComments();
  resetClaims();
  resetCurateCache();
  resetHeadStart();
  resetSaid();

  return { data: { events: reseeded.data, clearedState: cleared.data }, error: null };
}
