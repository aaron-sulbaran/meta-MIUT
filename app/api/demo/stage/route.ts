import { StageMoveSchema, moveStage, readStagePosition } from "@/lib/demo/stage-position";
import { readJsonBody } from "@/lib/http";

// The /demo stage's position (lib/demo/stage-position.ts).
// GET: where the stage is. POST { action: "next" | "back" } from the phone
// remote, or { action: "goto", index } from the stage itself.

export async function GET() {
  return Response.json({ data: await readStagePosition(), error: null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, StageMoveSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  return Response.json({ data: await moveStage(body.data), error: null });
}
