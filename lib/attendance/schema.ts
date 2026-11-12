import { z } from "zod";

// Interested and RSVP state for an event. Client-safe; no server imports here.
// There are no accounts in the demo: each browser gets a random viewer id
// (lib/attendance/viewer.ts), and counts are distinct viewer ids.

export const ATTENDANCE_ACTIONS = ["interested", "not_interested", "rsvp", "cancel_rsvp"] as const;
export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number];

export const ViewerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "viewer id must be 8 to 64 letters, digits, - or _");

export const AttendanceUpdateSchema = z.object({
  viewerId: ViewerIdSchema,
  action: z.enum(ATTENDANCE_ACTIONS),
});

export type AttendanceSummary = {
  eventId: string;
  interestedCount: number;
  goingCount: number;
  // Null when the event has no seat limit.
  capacity: number | null;
  seatsLeft: number | null;
  // Null when the request named no viewer.
  viewer: { interested: boolean; going: boolean } | null;
};

// Response shape of GET and POST /api/events/[id]/attendance. A full event
// answers POST rsvp with HTTP 409 and the current summary in `data`.
export type AttendanceRouteResponse = { data: AttendanceSummary | null; error: string | null };

export const EVENT_FULL_ERROR = "This event is full";
