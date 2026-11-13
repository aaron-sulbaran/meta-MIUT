import { readSaid, SaidRecordSchema, viewFits, writeSaid } from "@/lib/demo/said";
import { readJsonBody } from "@/lib/http";
import { currentViewer } from "@/lib/social/viewer";

// The request this viewer really made on the Muse card in this run, and Muse's
// answer (lib/demo/said.ts). GET: { data: record | null }. POST the record to
// keep it (the newest request wins). Cleared by the demo reset.

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const viewer = await currentViewer();
  return Response.json({ data: await readSaid(viewer.id), error: null }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, SaidRecordSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  if (!viewFits(body.data)) return Response.json({ data: null, error: "That answer is too large to keep" }, { status: 413 });
  const viewer = await currentViewer();
  return Response.json({ data: await writeSaid(viewer.id, body.data), error: null }, { headers: NO_STORE });
}
