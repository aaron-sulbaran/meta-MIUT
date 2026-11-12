import type { AlertDraft, AlertKind } from "@/lib/alerts/schema";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent } from "@/lib/events/schema";
import { walkMinutes } from "@/lib/geo";

// The one place that writes what a notification says. Everything comes from
// the event plus who is reading it: what is free, how far a walk, how much
// time is left. Pure, so it is easy to test and to replace.
// The final wording belongs to the alert item (t-f2aj): replace the body of
// composeAlert freely, keep its signature.

export type AlertContext = {
  now: Date;
  // The reader's location, for walk minutes. Omitted, the distance is left out.
  viewerLocation?: { lat: number; lng: number };
};

const TITLE_MAX_LENGTH = 120;
const BODY_MAX_LENGTH = 240;
const FOOD_LABEL_MAX_LENGTH = 24;
const MINUTE_MS = 60_000;

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: CAMPUS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

// "Pizza, vegetarian options" becomes "pizza"; anything long becomes "food".
function foodLabel(event: CampusEvent): string {
  const firstPiece = event.foodNote?.split(/[,.;(]/)[0]?.trim().toLowerCase() ?? "";
  return firstPiece.length > 0 && firstPiece.length <= FOOD_LABEL_MAX_LENGTH ? firstPiece : "food";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What the event gives away, in a few words: "Free pizza", "Free entry", "Pizza".
function offerPhrase(event: CampusEvent): string | null {
  if (event.free && event.food) return `Free ${foodLabel(event)}`;
  if (event.free) return "Free entry";
  if (event.food) return capitalize(foodLabel(event));
  return null;
}

function walkPhrase(event: CampusEvent, context: AlertContext): string | null {
  if (!context.viewerLocation) return null;
  return `${walkMinutes(context.viewerLocation, event.place)} min walk`;
}

function minutesBetween(fromMs: number, toMs: number): number {
  return Math.max(1, Math.round((toMs - fromMs) / MINUTE_MS));
}

// Time relative to now: "starts in 20 min", "on now, 45 min left", "starts at 7:30 PM".
function timePhrase(event: CampusEvent, now: Date): string {
  const nowMs = now.getTime();
  const startMs = Date.parse(event.start);
  const endMs = Date.parse(event.end);
  if (nowMs >= endMs) return `ended at ${clockTime(event.end)}`;
  if (nowMs >= startMs) return `on now, ${minutesBetween(nowMs, endMs)} min left`;
  const minutesAway = minutesBetween(nowMs, startMs);
  return minutesAway <= 60 ? `starts in ${minutesAway} min` : `starts at ${clockTime(event.start)}`;
}

function minutesLeftPhrase(event: CampusEvent, now: Date): string {
  const nowMs = now.getTime();
  const endMs = Date.parse(event.end);
  return nowMs >= endMs ? `ended at ${clockTime(event.end)}` : `${minutesBetween(nowMs, endMs)} min left`;
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join(", ");
}

export function composeAlert(event: CampusEvent, kind: AlertKind, context: AlertContext): AlertDraft {
  const where = event.place.name;
  const walk = walkPhrase(event, context);
  const offer = offerPhrase(event);

  let title: string;
  let body: string;
  switch (kind) {
    case "free_food_nearby":
      title = offer ? `${offer} at ${event.title}` : event.title;
      body = joinParts([where, walk, timePhrase(event, context.now)]);
      break;
    case "leftover_food":
      title = `Leftover ${foodLabel(event)} at ${event.title}`;
      body = joinParts([where, walk, minutesLeftPhrase(event, context.now)]);
      break;
    case "new_event":
      title = `${event.organizer.name} posted ${event.title}`;
      body = joinParts([offer, where, walk, timePhrase(event, context.now)]);
      break;
  }

  return {
    kind,
    eventId: event.id,
    title: clip(title, TITLE_MAX_LENGTH),
    body: clip(body, BODY_MAX_LENGTH),
  };
}
