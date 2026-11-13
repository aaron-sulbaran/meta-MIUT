import type { AskOutput } from "@/lib/muse/ask";

// Recorded stand-in for the ask job, for the question below.
export const RECORDED_QUESTION = "Any free concerts this week?";

export function askFixture(): AskOutput {
  return {
    answer: "The Festival Jazz Ensemble plays Thomas Tull Concert Hall on Friday at 8 PM, free for MIT students.",
    eventIds: ["evt-herb-pomeroy-jazz"],
  };
}
