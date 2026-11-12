import { z } from "zod";
import eventsFile from "@/data/seed/events.json";
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

const SeedEventsFileSchema = z.object({ events: z.array(SeedEventSchema) });
const SeedStudentFileSchema = z.object({ profile: StudentProfileSchema });

const MINUTE = 60_000;

export function loadSeedEvents(now: Date): CampusEvent[] {
  const file = SeedEventsFileSchema.parse(eventsFile);
  return file.events.map(({ startsInMinutes, durationMinutes, ...rest }) => {
    const start = new Date(now.getTime() + startsInMinutes * MINUTE);
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
