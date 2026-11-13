import { CAMPUS_TIME_ZONE } from "@/lib/brand";

// The demo's one clock. Every run of the pitch happens on the same campus
// afternoon: class ends at 3:00 PM and the stage opens at 3:05 PM, so the lock
// screen, the flyer (3:30 to 5:30 PM), the organizer's draft, and the walk home
// agree and look sane at any real hour. Client safe.
//
// The app still checks real time in places (a draft whose end has passed is
// dropped), so the run uses today's 3:05 PM while that afternoon is still ahead
// or under way, and tomorrow's once it is over.

export const DEMO_CLOCK = { hour: 15, minute: 5 } as const;
// After this campus time, today's demo afternoon is over and the run moves to tomorrow.
const ROLL_OVER = { hour: 16, minute: 30 } as const;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function campusParts(at: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Minutes the campus clock is ahead of UTC at `at` (negative in Boston). */
function campusOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** The instant a campus wall-clock time on the campus date of `day` happens. */
function campusInstant(day: Date, hour: number, minute: number): Date {
  const { year, month, day: date } = campusParts(day);
  const asUtc = Date.UTC(year, month - 1, date, hour, minute);
  const first = asUtc - campusOffsetMinutes(new Date(asUtc)) * MINUTE_MS;
  // Check the offset again at the found instant, so a daylight saving edge settles.
  return new Date(asUtc - campusOffsetMinutes(new Date(first)) * MINUTE_MS);
}

/** The run's clock: 3:05 PM campus time, today or (once today's afternoon is over) tomorrow. */
export function demoClock(real: Date = new Date()): Date {
  const rollOver = campusInstant(real, ROLL_OVER.hour, ROLL_OVER.minute);
  const day = real.getTime() < rollOver.getTime() ? real : new Date(real.getTime() + DAY_MS);
  return campusInstant(day, DEMO_CLOCK.hour, DEMO_CLOCK.minute);
}
