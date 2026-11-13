import "server-only";
import { z } from "zod";
import { loadState, saveState } from "@/lib/store/state";

// What each student and Muse said in Ask Muse, so a follow-up ("and tomorrow?")
// has context and Muse can refer back later. Kept in the shared store when Redis is set, else in this process.

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

const TurnSchema = z.object({ role: z.enum(["student", "muse"]), text: z.string(), at: z.string() });
const turnsKey = (userId: string) => `muse-turns:${userId}`;

/** The conversation as last saved in the shared store (Redis), else as held in this process. */
export async function loadTurns(userId: string): Promise<Turn[]> {
  const stored = await loadState(turnsKey(userId), z.array(TurnSchema));
  if (stored) store().set(userId, stored);
  return recentTurns(userId);
}

export async function saveTurns(userId: string, turns: Turn[]): Promise<void> {
  await loadTurns(userId);
  remember(userId, turns);
  await saveState(turnsKey(userId), recentTurns(userId));
}

export function resetConversations(): void {
  store().clear();
}
