import { legTimer } from "@/lib/demo/legs";
import { shareAnswer, storyExtractKey } from "@/lib/demo/head-start";
import { readJsonBody } from "@/lib/http";
import { ExtractInputSchema, extractEventDrafts } from "@/lib/muse/extract";

// Every event in one post. An empty list means the post is not an event.
// The demo story's flyer (beat O3) is one shared answer per run, started early by the
// stage, with a time budget (lib/demo/head-start.ts); every other post asks Muse here.
export async function POST(request: Request) {
  const legs = legTimer("extract");
  const body = await readJsonBody(request, ExtractInputSchema);
  legs.mark("body");
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const input = body.data;
  const key = storyExtractKey(input);
  const shared = key
    ? await shareAnswer({ key, request, beatId: "O3", run: () => extractEventDrafts(input), recorded: () => extractEventDrafts(input) })
    : null;
  const result = shared?.body ?? (await extractEventDrafts(input));
  legs.mark("muse");
  legs.done({ source: result.source, how: shared?.how ?? "own", museMs: shared?.body.museMs });
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
