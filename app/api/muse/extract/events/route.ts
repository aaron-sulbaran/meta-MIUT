import { readJsonBody } from "@/lib/http";
import { ExtractInputSchema, extractEventDrafts } from "@/lib/muse/extract";

// Every event in one post. An empty list means the post is not an event.
export async function POST(request: Request) {
  const body = await readJsonBody(request, ExtractInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const result = await extractEventDrafts(body.data);
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
