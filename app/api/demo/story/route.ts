import { ensureStoryEvent } from "@/lib/demo/story";

// GET: the event the demo follows (lib/demo/story.ts), listed now if it is missing.
export async function GET() {
  const result = await ensureStoryEvent(new Date());
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
