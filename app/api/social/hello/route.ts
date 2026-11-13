import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { hellosFrom, loadSocial, sayHello, saveSocial, whoIsGoing } from "@/lib/social/going";
import { EVERYONE } from "@/lib/social/fixtures/people";
import { writeHello } from "@/lib/social/muse-hello";
import { currentViewer } from "@/lib/social/viewer";
import { claimOnce } from "@/lib/store/state";

// POST { eventId, to, write? }: say hi to students going who are open to company.
// `to` is one id or several. With write: true, Muse writes the hello first (a real
// call, recorded line without a key) and it goes to everyone named; the answer
// carries the line, its source and how long Muse took, so the page can show it.
// Saying hi again to people who already have Muse's line returns that line: the
// stage and the phone can both ask and only one hello is written.
// GET ?eventId=: the hi this viewer already sent at this event (names and Muse's line),
// so every screen of the same person shows it once it is sent.
const HelloSchema = z.object({
  eventId: z.string().min(1),
  to: z.union([z.string().min(1).max(64), z.array(z.string().min(1).max(64)).min(1).max(5)]),
  write: z.boolean().optional(),
});

const nameOf = (id: string) => EVERYONE.find((person) => person.id === id)?.name ?? id;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const event = eventId ? await getEventStore().getEvent(eventId) : null;
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const sent = hellosFrom(event.id, viewer.id);
  const written = sent.find((hello) => hello.message !== null);
  return Response.json({
    data:
      sent.length > 0
        ? {
            to: sent.map((hello) => hello.to),
            names: sent.map((hello) => nameOf(hello.to)),
            message: written?.message ?? null,
            source: written?.recorded ? "fixture" : "muse",
          }
        : null,
    error: null,
  });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, HelloSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const event = await getEventStore().getEvent(body.data.eventId);
  if (!event) return Response.json({ data: null, error: "Event not found" }, { status: 404 });
  const viewer = await currentViewer();
  await loadSocial([event.id]);
  const ids = Array.isArray(body.data.to) ? body.data.to : [body.data.to];
  const before = whoIsGoing(event, viewer.id, viewer.interests);
  const people = ids.flatMap((id) => before.openToCompany.filter((person) => person.id === id));
  if (people.length !== ids.length) return Response.json({ data: null, error: "They are not looking for company at this event" }, { status: 409 });

  let hello: { message: string; source: "muse" | "fixture"; ms: number | null } | null = null;
  if (body.data.write) {
    // Already said, or being written, from another screen of the same person (the stage and the
    // phone can both ask): wait for that line and show it, write nothing new.
    const existing = async () => {
      await loadSocial([event.id]);
      const sent = hellosFrom(event.id, viewer.id);
      const already = sent.find((item) => item.message !== null && ids.includes(item.to));
      return already && ids.every((id) => sent.some((item) => item.to === id)) ? already : null;
    };
    const claimed = await claimOnce(`hello-write:${event.id}:${viewer.id}`, 30);
    let already = await existing();
    for (let waited = 0; !already && !claimed && waited < 20_000; waited += 500) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      already = await existing();
    }
    if (already) {
      const now = whoIsGoing(event, viewer.id, viewer.interests);
      return Response.json({ data: now, error: null, hello: { message: already.message!, source: already.recorded ? "fixture" : "muse", ms: null } });
    }
    const started = Date.now();
    const written = await writeHello(event, viewer.name, people);
    if (written.data === null) return Response.json({ data: null, error: written.error }, { status: 502 });
    hello = { message: written.data.message, source: written.source, ms: Date.now() - started };
  }
  for (const id of ids) {
    const result = sayHello(event, viewer.id, id, Date.now(), hello?.message, hello?.source === "fixture");
    if (result.error !== null) return Response.json({ data: null, error: result.error }, { status: 409 });
  }
  await saveSocial(event);
  return Response.json({ data: whoIsGoing(event, viewer.id, viewer.interests), error: null, hello });
}
