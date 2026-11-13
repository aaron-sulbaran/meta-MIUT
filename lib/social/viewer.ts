import { cookies } from "next/headers";
import { DEMO_USER_ID } from "@/lib/muse/memory";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { PERSONAS } from "@/lib/social/fixtures/people";

// The demo has no accounts. Each phone is one of the demo's people: the
// sample student (Aaron, User 1) unless the `demo-persona` cookie names
// another (lisa, user3), which the /demo persona switch sets per phone.

export const PERSONA_COOKIE = "demo-persona";

export type Viewer = { id: string; name: string; interests: string[] };

/** The sample student (Aaron), the viewer when no persona is set. */
export function demoViewer(): Viewer {
  return { id: DEMO_USER_ID, name: "Aaron", interests: loadDemoStudent().interests };
}

/** The viewer this phone plays: a persona from the cookie, else the sample student. */
export function viewerFor(personaId: string | undefined): Viewer {
  const persona = PERSONAS.find((person) => person.id === personaId && person.id !== DEMO_USER_ID);
  return persona ? { id: persona.id, name: persona.name, interests: persona.interests } : demoViewer();
}

/** The viewer for this request (server components and route handlers). */
export async function currentViewer(): Promise<Viewer> {
  return viewerFor((await cookies()).get(PERSONA_COOKIE)?.value);
}
