import { z } from "zod";
import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { loadSocial, sayHello, saveSocial, whoIsGoing } from "@/lib/social/going";
import { writeHello } from "@/lib/social/muse-hello";
import { currentViewer } from "@/lib/social/viewer";

// POST { eventId, to, write? }: say hi to students going who are open to company.
// `to` is one id or several. With write: true, Muse writes the hello first (a real
// call, recorded line without a key) and it goes to everyone named; the answer
// carries the line, its source and how long Muse took, so the page can show it.
const HelloSchema = z.object({
  eventId: z.string().min(1),
  to: z.union([z.string().min(1).max(64), z.array(z.string().min(1).max(64)).min(1).max(5)]),
  write: z.boolean().optional(),
});

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

  let hello: { message: string; source: "muse" | "fixture"; ms: number } | null = null;
  if (body.data.write) {
    const started = Date.now();
    const written = await writeHello(event, viewer.name, people);
    if (written.data === null) return Response.json({ data: null, error: written.error }, { status: 502 });
    hello = { message: written.data.message, source: written.source, ms: Date.now() - started };
  }
  for (const id of ids) {
    const result = sayHello(event, viewer.id, id, Date.now(), hello?.message);
    if (result.error !== null) return Response.json({ data: null, error: result.error }, { status: 409 });
  }
  await saveSocial(event);
  return Response.json({ data: whoIsGoing(event, viewer.id, viewer.interests), error: null, hello });
}
