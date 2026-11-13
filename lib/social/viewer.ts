import { cookies } from "next/headers";
import { DEMO_USER_ID } from "@/lib/muse/memory";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";
import { PERSONAS } from "@/lib/social/fixtures/people";
import { PERSONA_COOKIE, parsePersona, type PersonaId } from "@/lib/social/persona";

export { PERSONA_COOKIE } from "@/lib/social/persona";

// The demo has no accounts. Each phone is one of the demo's people: the
// sample student (Jolyn, User 1) unless the `demo-persona` cookie names
// another (lisa, user3, organizer), which the /demo stage sets per phone.

export type Viewer = { id: string; name: string; interests: string[] };

/** The sample student (Jolyn), the viewer when no persona is set. */
export function demoViewer(): Viewer {
  return { id: DEMO_USER_ID, name: "Jolyn", interests: loadDemoStudent().interests };
}

/** The persona this request's phone plays, or null for the sample student (server side). */
export async function personaFromCookies(): Promise<PersonaId | null> {
  return parsePersona((await cookies()).get(PERSONA_COOKIE)?.value);
}

/** The viewer for a persona id; personas without a student profile (organizer) read as the sample student. */
export function viewerFor(personaId: string | null | undefined): Viewer {
  const persona = PERSONAS.find((person) => person.id === personaId && person.id !== DEMO_USER_ID);
  return persona ? { id: persona.id, name: persona.name, interests: persona.interests } : demoViewer();
}

/** The viewer for this request (server components and route handlers). */
export async function currentViewer(): Promise<Viewer> {
  return viewerFor(await personaFromCookies());
}
