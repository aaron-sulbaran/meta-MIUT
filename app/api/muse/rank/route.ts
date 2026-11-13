import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { DEMO_USER_ID, loadInterestMemory } from "@/lib/muse/memory";
import { StudentContextSchema } from "@/lib/muse/profile";
import { personalizeEvents } from "@/lib/muse/rank";

const RankRequestSchema = z.object({
  profile: StudentContextSchema.optional(),
  userId: z.string().min(1).max(64).optional(),
  // Live location; walking times start here instead of the profile's home.
  location: StudentContextSchema.shape.home.optional(),
});

// Body may omit the profile and user; the demo student is used then.
// `data` is the top 3; `likely` is every event this week they may care about.
export async function POST(request: Request) {
  const body = await readJsonBody(request, RankRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const now = new Date();
  const events = await getEventStore().listEvents();
  const memory = await loadInterestMemory(body.data.userId ?? DEMO_USER_ID, now);
  const base = body.data.profile ?? loadDemoStudent();
  const profile = body.data.location ? { ...base, location: body.data.location } : base;
  const result = await personalizeEvents(profile, events, now, memory);
  if (result.error !== null) return Response.json(result, { status: 502 });
  const { picks, likely } = result.data;
  return Response.json({ ...result, data: picks, likely });
}
