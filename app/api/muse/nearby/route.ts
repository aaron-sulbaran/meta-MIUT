import { z } from "zod";
import { readJsonBody } from "@/lib/http";
import { DEMO_USER_ID } from "@/lib/muse/memory";
import { checkNearby } from "@/lib/muse/nearby";

const NearbyRequestSchema = z.object({
  userId: z.string().min(1).max(64).optional(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
});

// POST { userId?, location }: the device reports where the student is. Every
// likely event within a mile that has not alerted them yet sends one alert
// through the shared feed; the response lists them. The location is not stored.
export async function POST(request: Request) {
  const body = await readJsonBody(request, NearbyRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const result = await checkNearby({ userId: body.data.userId ?? DEMO_USER_ID, location: body.data.location });
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
