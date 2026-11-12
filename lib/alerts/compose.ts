import type { AlertDraft, AlertKind } from "@/lib/alerts/schema";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent } from "@/lib/events/schema";

// Turns an event into the banner text the student sees. Pure, so it is easy to
// test and to restyle; the copy here is a plain first pass.

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: CAMPUS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

const FOOD_LABEL_MAX_LENGTH = 24;

// "Pizza, vegetarian options" becomes "pizza"; anything long becomes "food".
function foodLabel(event: CampusEvent): string {
  const firstPiece = event.foodNote?.split(/[,.;(]/)[0]?.trim().toLowerCase() ?? "";
  return firstPiece.length > 0 && firstPiece.length <= FOOD_LABEL_MAX_LENGTH ? firstPiece : "food";
}

function startPhrase(event: CampusEvent, now: Date): string {
  const startMs = Date.parse(event.start);
  const endMs = Date.parse(event.end);
  const nowMs = now.getTime();
  if (startMs <= nowMs && nowMs < endMs) return `happening now until ${clockTime(event.end)}`;
  const minutesAway = Math.round((startMs - nowMs) / 60_000);
  if (minutesAway > 0 && minutesAway <= 60) return `starts in ${minutesAway} min`;
  return `at ${clockTime(event.start)}`;
}

export function composeAlert(event: CampusEvent, kind: AlertKind, now: Date): AlertDraft {
  const where = event.place.name;
  switch (kind) {
    case "free_food_nearby":
      return {
        kind,
        eventId: event.id,
        title: `Free ${foodLabel(event)} nearby`,
        body: `${event.title} at ${where}, ${startPhrase(event, now)}`,
      };
    case "leftover_food":
      return {
        kind,
        eventId: event.id,
        title: `Leftover ${foodLabel(event)}, come grab it`,
        body: `${event.organizer.name} at ${where}, until ${clockTime(event.end)}`,
      };
    case "new_event":
      return {
        kind,
        eventId: event.id,
        title: `${event.organizer.name} posted an event`,
        body: `${event.title} at ${where}, ${startPhrase(event, now)}`,
      };
  }
}
