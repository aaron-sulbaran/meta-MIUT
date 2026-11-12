import type { RankOutput } from "@/lib/muse/rank";

// Recorded stand-in for the rank job, written against the seed events.
export function rankFixture(): RankOutput {
  return {
    picks: [
      { eventId: "evt-acm-pizza-gdc", reason: "You follow this club and there is free pizza right now." },
      { eventId: "evt-climbing-gregory", reason: "Matches your interest in rock climbing, and you are free tonight." },
      { eventId: "evt-tacos-south-mall", reason: "Free tacos a short walk away before your next class." },
    ],
  };
}
