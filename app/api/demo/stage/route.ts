import { castFromSlug } from "@/lib/demo/beat-context";
import { DeckStepSchema, PhoneMoveSchema, reportDeckStep, StageMoveSchema, moveStage, movePhone, readPhonesSeen, readStagePosition, stampPhone } from "@/lib/demo/stage-position";
import { z } from "zod";

// The /demo stage's position (lib/demo/stage-position.ts).
// GET: where the stage is. ?phone=<slug> is a presenter phone polling (it is
// stamped as connected); ?phones=1 adds when each presenter phone last checked in.
// POST { action: "next" | "back" } from the phone remote, { action: "goto", index }
// from the stage itself, or { action, from, at } from a presenter's own phone,
// which moves the stage only on that presenter's beats (409 with where the stage is otherwise),
// or { action: "deck", at, name, step, steps? } from the stage: the deck step on beat `at`,
// read back as `data.deck` ({ name, step, steps } or absent) and dropped by the next move.

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const phone = castFromSlug(params.get("phone") ?? "");
  const [position, phones] = await Promise.all([
    readStagePosition(),
    params.get("phones") ? readPhonesSeen() : Promise.resolve(undefined),
    phone ? stampPhone(phone) : Promise.resolve(),
  ]);
  return Response.json({ data: position, phones, error: null }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => null);
  const fromPhone = PhoneMoveSchema.safeParse(raw);
  if (fromPhone.success) {
    const result = await movePhone(fromPhone.data);
    return result.moved
      ? Response.json({ data: result.data, error: null }, { headers: NO_STORE })
      : Response.json({ data: result.data, error: result.reason }, { status: 409, headers: NO_STORE });
  }
  const deck = DeckStepSchema.safeParse(raw);
  if (deck.success) {
    const result = await reportDeckStep(deck.data);
    return Response.json(
      { data: result.data, error: result.recorded ? null : "The stage has moved to another beat" },
      { status: result.recorded ? 200 : 409, headers: NO_STORE },
    );
  }
  const body = StageMoveSchema.safeParse(raw);
  if (!body.success) return Response.json({ data: null, error: raw === null ? "Body must be JSON" : z.prettifyError(body.error) }, { status: 400 });
  return Response.json({ data: await moveStage(body.data), error: null });
}
