import type { CampusEvent } from "@/lib/events/schema";
import { filterEvents } from "@/lib/events/time";

// The Events tab chips. Exactly one is active, as in the Facebook app.
export const EVENT_CHIPS = ["forYou", "free", "today", "week"] as const;
export type EventChip = (typeof EVENT_CHIPS)[number];

export const EVENT_CHIP_LABELS: Record<EventChip, string> = {
  forYou: "For you",
  free: "Free",
  today: "Today",
  week: "This week",
};

/** The heading over the list each chip shows. */
export const EVENT_CHIP_HEADINGS: Record<EventChip, string> = {
  forYou: "Free near you",
  free: "Free this week",
  today: "Today",
  week: "This week",
};

/**
 * For you: free events today (the Top 3 sits above them).
 * Free: every free event this week. Today and This week: everything in that window.
 */
export function eventsForChip(events: CampusEvent[], chip: EventChip, now: Date): CampusEvent[] {
  switch (chip) {
    case "forYou":
      return filterEvents(events, { window: "today", freeOnly: true, now });
    case "free":
      return filterEvents(events, { window: "week", freeOnly: true, now });
    case "today":
      return filterEvents(events, { window: "today", freeOnly: false, now });
    case "week":
      return filterEvents(events, { window: "week", freeOnly: false, now });
  }
}
