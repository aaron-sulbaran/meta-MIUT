import type { MatchOutput } from "@/lib/muse/match";

// Recorded stand-in for the match job: without Muse, a new post is treated as a new event.
export function matchFixture(): MatchOutput {
  return { sameAs: null, reason: "Muse is unavailable, so this post is treated as a new event.", changed: [] };
}
