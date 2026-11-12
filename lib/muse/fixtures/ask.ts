import type { AskOutput } from "@/lib/muse/ask";

// Recorded stand-in for the ask job, for the question below.
export const RECORDED_QUESTION = "I want to go rock climbing";

export function askFixture(): AskOutput {
  return {
    answer: "There is a free intro to bouldering night at Gregory Gym tonight. It is RSVP only, 30 spots.",
    eventIds: ["evt-climbing-gregory"],
  };
}
