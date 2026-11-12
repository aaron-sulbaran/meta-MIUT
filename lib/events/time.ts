import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { CampusEvent } from "@/lib/events/schema";

export const TIME_WINDOWS = ["now", "today", "week"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  now: "Now",
  today: "Today",
  week: "This week",
};

const MINUTE = 60_000;
const NOW_LOOKAHEAD_MINUTES = 60;

function campusDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE });
}

export function isInWindow(event: CampusEvent, window: TimeWindow, now: Date): boolean {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const nowMs = now.getTime();
  if (end < nowMs) return false;
  if (window === "now") return start <= nowMs + NOW_LOOKAHEAD_MINUTES * MINUTE;
  if (window === "today") return campusDayKey(new Date(start)) === campusDayKey(now) || start <= nowMs;
  return start <= nowMs + 7 * 24 * 60 * MINUTE;
}

export function filterEvents(
  events: CampusEvent[],
  options: { window: TimeWindow; freeOnly: boolean; now: Date },
): CampusEvent[] {
  return events
    .filter((event) => isInWindow(event, options.window, options.now))
    .filter((event) => !options.freeOnly || event.free)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function formatEventTime(event: CampusEvent, now: Date): string {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (start.getTime() <= now.getTime() && end.getTime() > now.getTime()) {
    return `Happening now, until ${formatClock(end)}`;
  }
  const sameDay = campusDayKey(start) === campusDayKey(now);
  const day = sameDay
    ? "Today"
    : start.toLocaleDateString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
  return `${day}, ${formatClock(start)} to ${formatClock(end)}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-US", { timeZone: CAMPUS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

/**
 * The grey date line on a Facebook event card: "Happening now", "Today at 4:30 PM",
 * "Tomorrow at 9 AM", or "Fri, Nov 14 at 6 PM", in the campus time zone.
 */
export function formatDateLine(event: CampusEvent, now: Date): string {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (start.getTime() <= now.getTime() && end.getTime() > now.getTime()) {
    return `Happening now, until ${formatShortClock(end)}`;
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * MINUTE);
  const day =
    campusDayKey(start) === campusDayKey(now)
      ? "Today"
      : campusDayKey(start) === campusDayKey(tomorrow)
        ? "Tomorrow"
        : start.toLocaleDateString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${formatShortClock(start)}`;
}

function formatShortClock(date: Date): string {
  const parts = date.toLocaleTimeString("en-US", { timeZone: CAMPUS_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  return parts.replace(":00", "");
}
