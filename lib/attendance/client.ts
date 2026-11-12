import type { AttendanceAction, AttendanceRouteResponse } from "@/lib/attendance/schema";

// Browser helpers for the event page. Both resolve to the route's
// { data, error } body and never throw; a network failure becomes an error.

function attendanceUrl(eventId: string): string {
  return `/api/events/${encodeURIComponent(eventId)}/attendance`;
}

async function readResponse(response: Response): Promise<AttendanceRouteResponse> {
  try {
    return (await response.json()) as AttendanceRouteResponse;
  } catch {
    return { data: null, error: `Attendance request failed (HTTP ${response.status})` };
  }
}

export async function fetchAttendance(eventId: string, viewerId: string): Promise<AttendanceRouteResponse> {
  try {
    const response = await fetch(`${attendanceUrl(eventId)}?viewer=${encodeURIComponent(viewerId)}`, {
      cache: "no-store",
    });
    return readResponse(response);
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateAttendance(
  eventId: string,
  viewerId: string,
  action: AttendanceAction,
): Promise<AttendanceRouteResponse> {
  try {
    const response = await fetch(attendanceUrl(eventId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ viewerId, action }),
    });
    return readResponse(response);
  } catch {
    return { data: null, error: "Network error" };
  }
}
