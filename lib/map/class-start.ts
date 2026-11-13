import { CAMPUS_TIME_ZONE } from "@/lib/brand";

// The class the student just walked out of, so the map's walk reads "Out of
// Data Structures" instead of a bare spot. The student stands at their class
// building (profile.home, the Stata Center in the seed).

type Block = { label: string; weekday: number; startTime: string; endTime: string };

function campusDayAndMinutes(at: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The last class that ended before `at` (campus time): today's latest finished
 * class, else the latest class on the closest earlier day. Null with no schedule.
 */
export function classJustEnded(schedule: Block[], at: Date): string | null {
  if (schedule.length === 0) return null;
  const now = campusDayAndMinutes(at);
  for (let back = 0; back < 7; back++) {
    const weekday = (now.weekday - back + 7) % 7;
    const done = schedule
      .filter((block) => block.weekday === weekday && (back > 0 || toMinutes(block.endTime) <= now.minutes))
      .sort((a, b) => toMinutes(b.endTime) - toMinutes(a.endTime));
    if (done[0]) return done[0].label;
  }
  return null;
}
