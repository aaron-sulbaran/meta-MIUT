// Which of the demo's people this phone plays, from the `demo-persona` cookie
// the /demo stage sets per phone. Client safe: the alert listener reads it in
// the browser; the server reads it through currentViewer() in viewer.ts.
// Unset (or unknown) means the sample student, who plays Aaron (User 1).

export const PERSONA_COOKIE = "demo-persona";

export const PERSONAS_IN_COOKIE = ["lisa", "user3", "organizer"] as const;
export type PersonaId = (typeof PERSONAS_IN_COOKIE)[number];

/** The sample student's viewer id; matches DEMO_USER_ID in lib/muse/memory.ts. */
export const DEFAULT_VIEWER_ID = "sample-student";

/** A cookie value as a persona id, or null for the sample student. */
export function parsePersona(value: string | null | undefined): PersonaId | null {
  return PERSONAS_IN_COOKIE.find((id) => id === value) ?? null;
}

/** The persona in a Cookie header or document.cookie string, or null for the sample student. */
export function personaFromCookieString(cookies: string): PersonaId | null {
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PERSONA_COOKIE) return parsePersona(decodeURIComponent(rest.join("=")));
  }
  return null;
}

// The profile initial each phone shows in the tab bar: Jolyn (the sample student), Lisa, Trish, Jing.
const PERSONA_INITIALS: Record<PersonaId | "default", string> = { default: "J", lisa: "L", user3: "T", organizer: "J" };

/** The tab bar's profile initial for a persona (null is the sample student, Jolyn). */
export function personaInitial(persona: PersonaId | null): string {
  return PERSONA_INITIALS[persona ?? "default"];
}

/** The viewer id the social layer and targeted alerts use for a persona. */
export function viewerIdFor(persona: PersonaId | null): string {
  return persona ?? DEFAULT_VIEWER_ID;
}
