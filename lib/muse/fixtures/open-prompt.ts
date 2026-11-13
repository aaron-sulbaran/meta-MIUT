import type { CampusEvent } from "@/lib/events/schema";
import type { OpenPromptOutput } from "@/lib/muse/open-prompt";

// Stand-in when Muse is unavailable: food first, then seats.
export function openPromptFixture(event: CampusEvent): OpenPromptOutput {
  if (event.food) {
    const food = event.foodNote?.split(/[,.;(]/)[0]?.trim().toLowerCase() || "food";
    return { leftover: "food", question: `Still have ${food} left? Open it to everyone?` };
  }
  return { leftover: "seats", question: "Still have room? Open it to everyone?" };
}
