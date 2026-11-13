import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody, savingRoute } from "@/lib/http";
import { hellosFrom, hellosTo, loadSocial, saveSocial, sayHelloBack } from "@/lib/social/going";
import { PERSONA_IDS } from "@/lib/social/fixtures/people";
import { currentViewer } from "@/lib/social/viewer";
import { EVERYONE } from "@/lib/social/fixtures/people";

// GET ?to=<person id>: the hellos someone was sent, newest first, with who sent them
// and the line Muse wrote (the demo phones of Jolyn and Lisa show "Trish said hi").
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!EVERYONE.some((person) => person.id === to)) return Response.json({ data: null, error: "Unknown person" }, { status: 400 });
  await loadSocial([]);
  const data = hellosTo(to).map((hello) => ({
    ...hello,
    fromName: EVERYONE.find((person) => person.id === hello.from)?.name ?? "Someone",
  }));
  return Response.json({ data, error: null });
}

// POST { eventId, from, to? }: this phone's person (Jolyn or Lisa) says hi back to a hi they got: their yes.
// POST { eventId, all: true }: the stage's Next on a laptop-only run, as the one who said hi: every
// one of the demo's own people it went to says yes, so the ending closes the same way.
const AnswerSchema = z.union([
  // `to` names the phone's person (one of the demo's own), so a phone answers as itself whatever its cookie says.
  z.object({ eventId: z.string().min(1), from: z.string().min(1).max(64), to: z.string().min(1).max(64).optional() }),
  z.object({ eventId: z.string().min(1), all: z.literal(true) }),
]);

export const POST = savingRoute("say hi back", async function post(request: Request) {
  const body = await readJsonBody(request, AnswerSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const pairs =
    "from" in body.data
      ? [{ from: body.data.from, to: body.data.to && PERSONA_IDS.has(body.data.to) ? body.data.to : viewer.id }]
      : hellosFrom(event.id, viewer.id)
          .filter((hello) => PERSONA_IDS.has(hello.to))
          .map((hello) => ({ from: viewer.id, to: hello.to }));
  for (const pair of pairs) {
    const result = sayHelloBack(event.id, pair.from, pair.to);
    if (result.error !== null) return Response.json({ data: null, error: result.error }, { status: 409 });
  }
  await saveSocial(event);
  return Response.json({ data: { answered: pairs.length }, error: null });
});

