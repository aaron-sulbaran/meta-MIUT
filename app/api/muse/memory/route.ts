import { z } from "zod";
import { readJsonBody } from "@/lib/http";
import { DEMO_USER_ID, InstagramSignalSchema, loadInterestMemory, saveSignals } from "@/lib/muse/memory";

const UserIdSchema = z.string().min(1).max(64);
const RecordRequestSchema = z.object({
  userId: UserIdSchema.optional(),
  signals: z.array(InstagramSignalSchema).min(1).max(100),
});

// GET ?userId=<id> returns what the interest memory has learned about a user.
export async function GET(request: Request) {
  const userId = UserIdSchema.safeParse(new URL(request.url).searchParams.get("userId") ?? DEMO_USER_ID);
  if (!userId.success) return Response.json({ data: null, error: "userId is invalid" }, { status: 400 });
  return Response.json({ data: await loadInterestMemory(userId.data), error: null });
}

// POST { userId?, signals } records Instagram interactions and returns the updated memory.
export async function POST(request: Request) {
  const body = await readJsonBody(request, RecordRequestSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  return Response.json({ data: await saveSignals(body.data.userId ?? DEMO_USER_ID, body.data.signals), error: null });
}
