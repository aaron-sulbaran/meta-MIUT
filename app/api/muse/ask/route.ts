import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { AskInputSchema, askAboutEvents } from "@/lib/muse/ask";
import { clearTurns, loadTurns, saveTurns } from "@/lib/muse/conversation";
import { friendContext } from "@/lib/map/friend-spots";
import { socialContext } from "@/lib/social/muse-friends";
import { currentViewer } from "@/lib/social/viewer";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { compileCandidates } from "@/lib/muse/candidates";
import { DEMO_USER_ID, loadInterestMemory, saveSignals } from "@/lib/muse/memory";
import { origin } from "@/lib/muse/profile";

// POST { question }: Muse answers with events, actions for the client to carry
// out, and maybe a follow-up. Each turn is remembered, and the topics it showed
// interest in feed the student's interest memory.
export async function POST(request: Request) {
  const body = await readJsonBody(request, AskInputSchema);
  if (body.error !== null) return Response.json({ data: null, error: body.error }, { status: 400 });
  const now = new Date();
  const student = loadDemoStudent();
  const events = await getEventStore().listEvents();
  const memory = await loadInterestMemory(DEMO_USER_ID, now);
  const likely = compileCandidates(student, memory, events, now);
  if (body.data.fresh) await clearTurns(DEMO_USER_ID);
  const history = body.data.fresh ? [] : await loadTurns(DEMO_USER_ID);
  // A friend named in the request who shares their location (seeded for the
  // demo): Muse reads where they are, so "closer to both of us" needs no follow-up.
  const friend = friendContext(body.data.question);
  const asked = friend ? { ...body.data, question: `${body.data.question}\n${friend}` } : body.data;
  const social = await socialContext(await currentViewer(), events, now);
  const result = await askAboutEvents(asked, events, now, student, history, memory, likely, social);
  if (result.error !== null) return Response.json(result, { status: 502 });

  const at = now.toISOString();
  if (result.source === "muse") {
    const said = [result.data.answer, result.data.followUp].filter(Boolean).join(" ");
    await saveTurns(DEMO_USER_ID, [
      { role: "student", text: body.data.question, at },
      { role: "muse", text: said, at },
    ]);
    if (result.data.learnedTopics.length > 0) {
      await saveSignals(DEMO_USER_ID, [{ kind: "comment", at, topics: result.data.learnedTopics, text: `Asked Muse: ${body.data.question}` }], now);
    }
  }
  const walk = result.data.actions.find((action) => action.type === "plan_night");
  const plan = walk ? { from: origin(student), to: student.home, note: body.data.question.slice(0, 300), eventId: walk.eventId } : null;
  return Response.json({ ...result, data: { ...result.data, plan } });
}
