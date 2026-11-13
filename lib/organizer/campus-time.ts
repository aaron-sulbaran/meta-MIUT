import { CAMPUS_TIME_ZONE } from "@/lib/brand";

// The organizer edits times as campus wall-clock time ("2026-11-12T19:30", what a
// datetime-local input holds), whatever time zone the device is in. These convert
// between that and real instants. Client safe.

const MINUTE_MS = 60_000;

type WallParts = { year: number; month: number; day: number; hour: number; minute: number };

function wallParts(instantMs: number, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

const pad = (value: number) => String(value).padStart(2, "0");

function formatWall({ year, month, day, hour, minute }: WallParts): string {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

// Minutes the zone is ahead of UTC at that instant (New York in November: -300).
function offsetMinutes(instantMs: number, timeZone: string): number {
  const flooredMs = Math.floor(instantMs / MINUTE_MS) * MINUTE_MS;
  const wall = wallParts(flooredMs, timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return Math.round((wallAsUtc - flooredMs) / MINUTE_MS);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/** An instant as campus wall-clock time, "YYYY-MM-DDTHH:mm". Empty for an invalid date. */
export function toCampusWallTime(iso: string, timeZone: string = CAMPUS_TIME_ZONE): string {
  const instantMs = Date.parse(iso);
  if (Number.isNaN(instantMs)) return "";
  return formatWall(wallParts(instantMs, timeZone));
}

/** Campus wall-clock time back to ISO 8601 with the campus offset, or null when it does not parse. */
export function fromCampusWallTime(wall: string, timeZone: string = CAMPUS_TIME_ZONE): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(wallAsUtc)) return null;
  // Guess the offset, then correct once in case the guess crossed a daylight saving change.
  let offset = offsetMinutes(wallAsUtc, timeZone);
  const corrected = offsetMinutes(wallAsUtc - offset * MINUTE_MS, timeZone);
  if (corrected !== offset) offset = corrected;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${formatOffset(offset)}`;
}
