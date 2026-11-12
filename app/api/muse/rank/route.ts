import { z } from "zod";
import { StudentProfileSchema } from "@/lib/events/schema";
import { loadSeedStudent } from "@/lib/events/seed";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { DEMO_USER_ID, getInterestMemory } from "@/lib/muse/memory";
import { personalizeEvents } from "@/lib/muse/rank";

const RankRequestSchema = z.object({
  profile: StudentProfileSchema.optional(),
  userId: z.string().min(1).max(64).optional(),
});

// Body may omit the profile and user; the seeded student is used then.
// `data` is the top 3; `likely` is every event this week they may care about.
export async function POST(request: Request) {
  const body = await readJsonBody(request, RankRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const now = new Date();
  const events = await getEventStore().listEvents();
  const memory = getInterestMemory(body.data.userId ?? DEMO_USER_ID, now);
  const result = await personalizeEvents(body.data.profile ?? loadSeedStudent(), events, now, memory);
  if (result.error !== null) return Response.json(result, { status: 502 });
  const { picks, likely } = result.data;
  return Response.json({ ...result, data: picks, likely });
}
