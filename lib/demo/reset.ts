import "server-only";
import { getAlertFeed } from "@/lib/alerts/feed";
import { getAttendanceStore } from "@/lib/attendance/store";
import { getEventStore, type StoreResult } from "@/lib/events/store";
import { resetConversations } from "@/lib/muse/conversation";
import { resetInterestMemory } from "@/lib/muse/memory";
import { resetNearbyAlerts } from "@/lib/muse/nearby";
import { resetSaid, SAID_PREFIX } from "@/lib/demo/said";
import { resetCurateCache } from "@/lib/curate/cache";
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
  // The curate answer each viewer shares between the stage and their phone (lib/curate/cache.ts).
  "curate-cache:",
  "claim:curate-cache:",
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
  resetSaid();

  return { data: { events: reseeded.data, clearedState: cleared.data }, error: null };
}
