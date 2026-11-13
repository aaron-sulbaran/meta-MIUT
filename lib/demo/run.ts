// A run of the pitch: one id, made by the fresh run (the demo reset) and kept in the
// shared stage record (lib/demo/stage-position.ts). Everything a run remembers is
// cleared when a new one starts, on every server instance (lib/store/state.ts
// followRun) and in every open browser (clearClientDemoState below). Client safe.

/** A new run id: the time it started and a little randomness. */
export function newRunId(now: Date): string {
  return `run-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** What a fresh run clears, as the console and the stage say it afterwards. */
export const FRESH_RUN_CLEARS = [
  "events back to the seed, so the story event can be published once",
  "alerts",
  "going, interested and RSVPs",
  "Open to company, hellos and their replies, invites",
  "comments",
  "what each presenter said to Muse and its answer",
  "Muse memory, Ask history and nearby alerts",
  "kept Muse answers (curate, Top 3, the head start)",
  "the phones' check-ins and signals, the deck step",
] as const;

// An old run: it went past the opening, and nothing has moved for this long.
export const STALE_RUN_MS = 20 * 60_000;

export type RunStamp = { index: number; at?: string; run?: string; movedAt?: string; furthest?: number };

/** True when the record is a run that was played and then left alone (or from before runs existed). */
export function isStaleRun(position: RunStamp | null | undefined, now = Date.now()): boolean {
  if (!position) return false;
  const furthest = position.furthest ?? position.index;
  const lastMove = Date.parse(position.movedAt ?? position.at ?? "");
  if (!position.run) return furthest > 0 || !Number.isFinite(lastMove) || now - lastMove > STALE_RUN_MS;
  return furthest > 0 && Number.isFinite(lastMove) && now - lastMove > STALE_RUN_MS;
}

/** "47 min ago" or "3 h ago", for the stale-run note. */
export function lastMoveLabel(position: RunStamp | null | undefined, now = Date.now()): string {
  const lastMove = Date.parse(position?.movedAt ?? position?.at ?? "");
  if (!Number.isFinite(lastMove)) return "a while ago";
  const minutes = Math.max(1, Math.round((now - lastMove) / 60_000));
  return minutes < 90 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

// The reset token, kept only in this browser (never in a URL, never logged, sent only to the reset route).
const TOKEN_KEY = "demo-reset-token";

export function readResetToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveResetToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the token works for this request only.
  }
}

// What a browser keeps for the demo between page loads: dismissed cards, the Muse
// intro already seen. Session storage (the Ask thread, Interested flags, scroll
// places) is cleared whole; the reset token and this browser's viewer id stay.
const CLIENT_RUN_KEYS = ["map:dismissed", "muse:intro-seen"];
const SEEN_RUN_KEY = "demo-run";

/** Clears this browser's saved demo state when it has not yet seen `run`. True when it cleared. */
export function clearClientDemoState(run: string | undefined): boolean {
  try {
    if (run && window.localStorage.getItem(SEEN_RUN_KEY) === run) return false;
    for (const key of CLIENT_RUN_KEYS) window.localStorage.removeItem(key);
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    window.sessionStorage.clear();
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    if (run) window.localStorage.setItem(SEEN_RUN_KEY, run);
    return true;
  } catch {
    return false;
  }
}

export type FreshRunResult =
  | { ok: true; run: string | null; cleared: readonly string[] }
  | { ok: false; needsToken: boolean; message: string };

/** Asks the server for a fresh run with this browser's token. */
export async function requestFreshRun(token = readResetToken()): Promise<FreshRunResult> {
  try {
    const response = await fetch("/api/demo/reset", {
      method: "POST",
      headers: token ? { "x-demo-token": token } : {},
    });
    const body = (await response.json().catch(() => null)) as { data: { run?: string; cleared?: string[] } | null; error: string | null } | null;
    if (response.status === 403) {
      return {
        ok: false,
        needsToken: true,
        message: token ? "That reset token is wrong. Nothing was cleared." : "A fresh run needs the reset token. Nothing was cleared.",
      };
    }
    if (!response.ok || !body?.data) return { ok: false, needsToken: false, message: `The fresh run failed${body?.error ? `: ${body.error}` : ""}. Nothing was cleared.` };
    return { ok: true, run: body.data.run ?? null, cleared: body.data.cleared ?? FRESH_RUN_CLEARS };
  } catch {
    return { ok: false, needsToken: false, message: "Could not reach the app. Nothing was cleared." };
  }
}
