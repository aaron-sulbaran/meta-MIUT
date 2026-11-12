import "server-only";
import { z } from "zod";
import type { CampusEvent, RankedPick, StudentProfile } from "@/lib/events/schema";
import { walkMinutes } from "@/lib/geo";
import { rankFixture } from "@/lib/muse/fixtures/rank";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Student profile plus events to the top 3 picks. Walking time is computed
// here, never taken from the model.

export const RankOutputSchema = z.object({
  picks: z.array(z.object({ eventId: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
});

export type RankOutput = z.infer<typeof RankOutputSchema>;

export const RANK_STRUCTURED_OUTPUT = museStructuredOutput("event_picks", RankOutputSchema);

export async function rankEvents(
  profile: StudentProfile,
  events: CampusEvent[],
  now = new Date(),
): Promise<MuseJobResult<RankedPick[]>> {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const candidates = events
    .filter((event) => Date.parse(event.end) > now.getTime())
    .map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      place: event.place.name,
      walkMinutes: walkMinutes(profile.home, event.place),
      free: event.free,
      food: event.food,
      access: event.access,
      organizer: event.organizer.handle,
    }));

  const result = await runMuseJob({
    request: {
      system:
        'Pick the 3 best events for this student today. Return JSON only: {"picks":[{"eventId":"...","reason":"one short sentence"}]}. Favor free events, short walks, interests, clubs they follow, and times that do not clash with their schedule.',
      prompt: `Now: ${now.toISOString()}\nStudent: ${JSON.stringify(profile)}\nEvents: ${JSON.stringify(candidates)}`,
      structuredOutput: RANK_STRUCTURED_OUTPUT,
    },
    outputSchema: RankOutputSchema,
    fixture: rankFixture,
    accept: (output) =>
      output.picks.every((pick) => eventsById.has(pick.eventId)) ? null : "Muse picked an unknown event id",
  });

  if (result.error !== null) return result;
  const picks = result.data.picks.flatMap((pick) => {
    const event = eventsById.get(pick.eventId);
    return event ? [{ eventId: pick.eventId, reason: pick.reason, walkMinutes: walkMinutes(profile.home, event.place) }] : [];
  });
  return { ...result, data: picks };
}
