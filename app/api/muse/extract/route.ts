import { readJsonBody } from "@/lib/http";
import { ExtractInputSchema, NOT_AN_EVENT, extractEventDraft } from "@/lib/muse/extract";

export async function POST(request: Request) {
  const body = await readJsonBody(request, ExtractInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const result = await extractEventDraft(body.data);
  const status = result.error === null ? 200 : result.error === NOT_AN_EVENT ? 422 : 502;
  return Response.json(result, { status });
}
