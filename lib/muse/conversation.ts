import "server-only";

// What each student and Muse said in Ask Muse, so a follow-up ("and tomorrow?")
// has context and Muse can refer back later. Process-local: a restart clears it.

export type Turn = { role: "student" | "muse"; text: string; at: string };

export const MAX_TURNS = 20;

const KEY = Symbol.for("muse.conversations");

function store(): Map<string, Turn[]> {
  const scope = globalThis as unknown as Record<symbol, Map<string, Turn[]> | undefined>;
  return (scope[KEY] ??= new Map());
}

export function recentTurns(userId: string): Turn[] {
  return store().get(userId) ?? [];
}

export function remember(userId: string, turns: Turn[]): void {
  store().set(userId, [...recentTurns(userId), ...turns].slice(-MAX_TURNS));
}

export function resetConversations(): void {
  store().clear();
}
