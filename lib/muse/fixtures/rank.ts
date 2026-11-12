import type { RankOutput } from "@/lib/muse/rank";
import type { LikelyEvent } from "@/lib/muse/types";

// Stand-in for the rank job while Muse is offline: the top of the scored
// candidate pool, with its computed reasons. Personal to the student, not live.
export function rankFixture(pool: LikelyEvent[]): RankOutput {
  return { picks: pool.slice(0, 3).map((candidate) => ({ eventId: candidate.eventId, reason: candidate.reason })) };
}
