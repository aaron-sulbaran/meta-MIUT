import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { ExtractOutput } from "@/lib/muse/extract";

// Recorded stand-in for the extract job. Used when Muse is not configured or fails.
export const SAMPLE_FLYER_CAPTION =
  "Free pho night! Vietnamese Student Association, tomorrow 6 to 8pm at the Texas Union Ballroom. Open to everyone, first 80 bowls. Bring a friend.";

const HOUR = 3_600_000;

// Tomorrow at the given campus hour, as an absolute instant.
function tomorrowAtCampusHour(now: Date, hour: number): Date {
  const tomorrow = new Date(now.getTime() + 24 * HOUR);
  const campusDate = tomorrow.toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE });
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(tomorrow)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return new Date(`${campusDate}T${String(hour).padStart(2, "0")}:00:00${offset}`);
}

export function extractFixture(now: Date): ExtractOutput {
  const start = tomorrowAtCampusHour(now, 18);
  const end = tomorrowAtCampusHour(now, 20);
  return {
    title: "Free pho night",
    description: "Vietnamese Student Association pho night. Open to everyone, first 80 bowls.",
    start: start.toISOString(),
    end: end.toISOString(),
    placeName: "Texas Union Ballroom",
    free: true,
    food: true,
    foodNote: "Pho, first 80 bowls",
    access: { kind: "open" },
    confidence: { title: 0.92, description: 0.8, start: 0.74, end: 0.7, place: 0.88, free: 0.95, food: 0.97, access: 0.6 },
  };
}
