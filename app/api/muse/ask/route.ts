import { getEventStore } from "@/lib/events/store";
import { readJsonBody } from "@/lib/http";
import { AskInputSchema, askAboutEvents } from "@/lib/muse/ask";
import { recentTurns, remember } from "@/lib/muse/conversation";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { DEMO_USER_ID, recordSignals } from "@/lib/muse/memory";
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
  const result = await askAboutEvents(body.data, events, now, student, recentTurns(DEMO_USER_ID));
  if (result.error !== null) return Response.json(result, { status: 502 });

  const at = now.toISOString();
  if (result.source === "muse") {
    const said = [result.data.answer, result.data.followUp].filter(Boolean).join(" ");
    remember(DEMO_USER_ID, [
      { role: "student", text: body.data.question, at },
      { role: "muse", text: said, at },
    ]);
    if (result.data.learnedTopics.length > 0) {
      recordSignals(DEMO_USER_ID, [{ kind: "comment", at, topics: result.data.learnedTopics, text: `Asked Muse: ${body.data.question}` }], now);
    }
  }
  const plan = result.data.actions.some((action) => action.type === "plan_night")
    ? { from: origin(student), to: student.home }
    : null;
  return Response.json({ ...result, data: { ...result.data, plan } });
}
