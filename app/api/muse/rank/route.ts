import { z } from "zod";
import { StudentProfileSchema } from "@/lib/events/schema";
import { loadSeedStudent } from "@/lib/events/seed";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { rankEvents } from "@/lib/muse/rank";

const RankRequestSchema = z.object({ profile: StudentProfileSchema.optional() });

// Body may omit the profile; the seeded student is used then.
export async function POST(request: Request) {
  const body = await readJsonBody(request, RankRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const events = await getEventStore().listEvents();
  const result = await rankEvents(body.data.profile ?? loadSeedStudent(), events);
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
