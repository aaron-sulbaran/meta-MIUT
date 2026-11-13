import "server-only";
import { resetComments } from "@/lib/social/comments";
import { resetSocial } from "@/lib/social/going";
import { resetConversations } from "@/lib/muse/conversation";
import { resetInterestMemory } from "@/lib/muse/memory";
import { resetNearbyAlerts } from "@/lib/muse/nearby";
import { resetHeadStart } from "@/lib/demo/head-start";
import { resetSaid } from "@/lib/demo/said";
import { resetSharedAnswers } from "@/lib/store/shared-answer";
import { resetClaims } from "@/lib/store/state";

// Everything one server instance holds in memory for the demo: what a run remembers
// (Muse memory and Ask turns, nearby alerts sent, going, hellos, comments, kept
// answers, claims, the presenter's words on the Muse card, the Top 3, which phones
// checked in). The fresh run clears it on the instance that runs it; every other
// instance clears it the moment it sees the new run (followRun in lib/store/state.ts).

const held = globalThis as typeof globalThis & {
  __musePicks?: Map<string, unknown>;
  __musePicksRunning?: Map<string, unknown>;
  __demoPhoneSeen?: Record<string, string>;
};

export function clearInstanceMemory(): void {
  resetInterestMemory();
  resetConversations();
  resetNearbyAlerts();
  resetSocial();
  resetComments();
  resetClaims();
  resetSharedAnswers();
  resetHeadStart();
  resetSaid();
  held.__musePicks?.clear();
  held.__musePicksRunning?.clear();
  held.__demoPhoneSeen = {};
}
