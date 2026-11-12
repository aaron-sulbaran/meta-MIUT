import { z } from "zod";

// The event contract. Every lane builds against these types.
// Change only through a hub proposal: other lanes depend on every field.

const isoDateTime = z.iso.datetime({ offset: true });
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const unitScore = z.number().min(0).max(1);

export const PlaceSchema = z.object({
  name: z.string().min(1),
  lat: latitude,
  lng: longitude,
});

export const AccessSchema = z.object({
  kind: z.enum(["open", "rsvp"]),
  capacity: z.number().int().positive().optional(),
});

export const OrganizerSchema = z.object({
  name: z.string().min(1),
  handle: z.string().min(1),
});

export const SourceSchema = z.object({
  kind: z.enum(["instagram", "manual"]),
  postUrl: z.string().url().optional(),
  caption: z.string().optional(),
  imagePath: z.string().optional(),
});

export const CONFIDENCE_FIELDS = [
  "title",
  "description",
  "start",
  "end",
  "place",
  "free",
  "food",
  "access",
  "organizer",
] as const;

export const ConfidenceSchema = z.partialRecord(z.enum(CONFIDENCE_FIELDS), unitScore);

export const EventSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    start: isoDateTime,
    end: isoDateTime,
    place: PlaceSchema,
    free: z.boolean(),
    food: z.boolean(),
    foodNote: z.string().optional(),
    access: AccessSchema,
    organizer: OrganizerSchema,
    source: SourceSchema,
    status: z.enum(["draft", "published"]),
    confidence: ConfidenceSchema.optional(),
    createdAt: isoDateTime,
  })
  .refine((event) => Date.parse(event.end) > Date.parse(event.start), {
    message: "end must be after start",
    path: ["end"],
  });

export const ScheduleBlockSchema = z.object({
  label: z.string().min(1),
  // 0 is Sunday, matching Date.getDay().
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const StudentProfileSchema = z.object({
  name: z.string().min(1),
  school: z.string().min(1),
  follows: z.array(z.string()),
  interests: z.array(z.string()),
  schedule: z.array(ScheduleBlockSchema),
  home: z.object({ lat: latitude, lng: longitude }),
});

export const RankedPickSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().min(1),
  walkMinutes: z.number().int().nonnegative(),
});

export type Place = z.infer<typeof PlaceSchema>;
export type Access = z.infer<typeof AccessSchema>;
export type Organizer = z.infer<typeof OrganizerSchema>;
export type EventSource = z.infer<typeof SourceSchema>;
export type ConfidenceField = (typeof CONFIDENCE_FIELDS)[number];
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type CampusEvent = z.infer<typeof EventSchema>;
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>;
export type StudentProfile = z.infer<typeof StudentProfileSchema>;
export type RankedPick = z.infer<typeof RankedPickSchema>;

export type ParseResult<T> = { data: T; error: null } | { data: null; error: string };

export function parseEvent(input: unknown): ParseResult<CampusEvent> {
  const result = EventSchema.safeParse(input);
  if (result.success) return { data: result.data, error: null };
  return { data: null, error: z.prettifyError(result.error) };
}

export function parseStudentProfile(input: unknown): ParseResult<StudentProfile> {
  const result = StudentProfileSchema.safeParse(input);
  if (result.success) return { data: result.data, error: null };
  return { data: null, error: z.prettifyError(result.error) };
}
