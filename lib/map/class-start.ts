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

function clockLabel(hhmm: string): string {
  const hours = Number(hhmm.slice(0, 2));
  const minutes = hhmm.slice(3, 5);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00" ? `${hour12} ${suffix}` : `${hour12}:${minutes} ${suffix}`;
}

/**
 * The crawl sheet's one-line headline, from the student's day (Lisa): before
 * the next class today, right out of one, done for the day, or no class today.
 * `at` is when the walk leaves; `stops` is how many free stops it has.
 */
export function crawlHeadline(schedule: Block[], at: Date, stops: number): string {
  const count = `${stops} free ${stops === 1 ? "stop" : "stops"}`;
  if (stops === 0) return "Nothing free on the way right now";
  const now = campusDayAndMinutes(at);
  const today = schedule.filter((block) => block.weekday === now.weekday);
  const next = today
    .filter((block) => toMinutes(block.startTime) > now.minutes)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];
  if (next) return `${count} before ${next.label} at ${clockLabel(next.startTime)}`;
  const ended = today
    .filter((block) => toMinutes(block.endTime) <= now.minutes)
    .sort((a, b) => toMinutes(b.endTime) - toMinutes(a.endTime))[0];
  // Within an hour of class ending reads as just out of it.
  if (ended && now.minutes - toMinutes(ended.endTime) <= 60) return `Out of ${ended.label}: ${count} on the way`;
  if (today.length > 0) return `Done with class: ${count} on the way`;
  return `No class today: ${count} on the way`;
}
