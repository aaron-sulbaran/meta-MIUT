import { demoClock } from "@/lib/demo/clock";
import { ensureStoryEvent } from "@/lib/demo/story";

// GET: the event the demo follows (lib/demo/story.ts), listed now if it is missing,
// on the demo's fixed afternoon (lib/demo/clock.ts) like every other beat.
export async function GET() {
  const result = await ensureStoryEvent(demoClock());
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
