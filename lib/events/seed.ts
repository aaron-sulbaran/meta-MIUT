import { z } from "zod";
import eventsFile from "@/data/seed/events.json";
import testEventsFile from "@/data/seed/test-events.json";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import studentFile from "@/data/seed/student.json";
import {
  AccessSchema,
  EventSchema,
  OrganizerSchema,
  PlaceSchema,
  SourceSchema,
  StudentProfileSchema,
  type CampusEvent,
  type StudentProfile,
} from "@/lib/events/schema";

// Seed files store times relative to load so the demo never looks stale.
const SeedEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  startsInMinutes: z.number().int(),
  durationMinutes: z.number().int().positive(),
  place: PlaceSchema,
  free: z.boolean(),
  food: z.boolean(),
  foodNote: z.string().optional(),
  access: AccessSchema,
  organizer: OrganizerSchema,
  source: SourceSchema,
});

// anchorCampusTime ("19:00") counts offsets from that campus clock time on the nearest day, so real
// events keep their real clock times and only the date moves with the demo day.
const SeedEventsFileSchema = z.object({
  anchorCampusTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  events: z.array(SeedEventSchema),
});
const SeedStudentFileSchema = z.object({ profile: StudentProfileSchema });

const MINUTE = 60_000;
const QUARTER_HOUR = 15 * MINUTE;

function campusOffset(at: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  return name?.replace("GMT", "") || "+00:00";
}

// The instant closest to now when the campus clock reads hh:mm (yesterday, today, or tomorrow).
function nearestCampusClock(now: Date, hhmm: string): number {
  const candidates = [-1, 0, 1].map((days) => {
    const day = new Date(now.getTime() + days * 24 * 60 * MINUTE);
    const date = day.toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE });
    return Date.parse(`${date}T${hhmm}:00${campusOffset(day)}`);
  });
  return candidates.reduce((best, next) => (Math.abs(next - now.getTime()) < Math.abs(best - now.getTime()) ? next : best));
}

// The real MIT events, plus made-up test events nearby (Harvard, BU, Northeastern) unless
// SEED_TEST_EVENTS=off.
export function loadSeedEvents(now: Date): CampusEvent[] {
  const real = loadSeedFile(eventsFile, now);
  return process.env.SEED_TEST_EVENTS === "off" ? real : [...real, ...loadSeedFile(testEventsFile, now)];
}

function loadSeedFile(raw: unknown, now: Date): CampusEvent[] {
  const file = SeedEventsFileSchema.parse(raw);
  // Without an anchor time, offsets count from the nearest quarter hour, so times read 7:30, not 7:33.
  const anchor = file.anchorCampusTime
    ? nearestCampusClock(now, file.anchorCampusTime)
    : Math.round(now.getTime() / QUARTER_HOUR) * QUARTER_HOUR;
  return file.events.map(({ startsInMinutes, durationMinutes, ...rest }) => {
    const start = new Date(anchor + startsInMinutes * MINUTE);
    const end = new Date(start.getTime() + durationMinutes * MINUTE);
    return EventSchema.parse({
      ...rest,
      start: start.toISOString(),
      end: end.toISOString(),
      status: "published",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * MINUTE).toISOString(),
    });
  });
}

export function loadSeedStudent(): StudentProfile {
  return SeedStudentFileSchema.parse(studentFile).profile;
}
