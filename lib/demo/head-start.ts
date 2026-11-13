import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { BEATS } from "@/lib/demo/beats";
import { isStoryCaption } from "@/lib/demo/story-fixtures";
import { WALK_HOME } from "@/lib/demo/walk-home";
import { readStagePosition } from "@/lib/demo/stage-position";
import { withoutMuse } from "@/lib/muse/client";
import { claimOnce, loadState, saveState } from "@/lib/store/state";

// A head start for the demo's three slow live Muse moments (the flyer read at O3, the
// walk home at U1b, Trish's first Events map at U3b). The stage knows what comes next,
// so it asks for each answer a few beats early (components/demo/head-start.ts), and
// the screen that asks the same question later shares that one call:
//
// - The first asker runs the real call; anyone asking the same thing while it runs
//   waits for that answer, and anyone after gets it, for a few minutes per run.
//   Kept in this process and in the shared store (Redis), cleared by the demo reset.
//   Only live answers are kept: a failed call is asked again by the next screen.
// - Every answer carries `museMs`, the real time its call took, so a screen that got
//   it ready-made still stamps how long Muse took, not how long it waited.
// - A time budget: a screen whose live answer is not in about 8 s after its beat
//   appeared gets the story's recorded answer (Muse switched off for that one
//   request, so the job's own fixture path answers and says "Recorded"). That run
//   keeps the recorded answer for that moment, so a live answer arriving later is
//   never swapped in under the presenter, and every phone shows the same one.

export const HEAD_START_HEADER = "x-demo-head-start";
export const ANSWER_BUDGET_MS = 8_000;
export const HEAD_START_KEEP_MS = 5 * 60_000;
export const HEAD_START_PREFIX = "head-start:";
// A held screen (loaded ahead, U1b) waits at most this long in all before its recorded answer.
const MAX_HOLD_MS = 90_000;
// A screen that asks well after its beat appeared (a reload) still gets this much time.
const LATE_ASKER_MS = 5_000;
// Waiting for another server instance's call before asking Muse ourselves.
const WAIT_FOR_FIRST_MS = 25_000;
const POLL_MS = 150;
// The stage counts as running a show when it moved within this long.
const STAGE_FRESH_MS = 30 * 60_000;

export type SharedBody = { source?: unknown; data?: unknown };
export type HowAnswered = "started" | "joined" | "stored" | "recorded-kept" | "recorded-budget" | "head-start";
type Answer<Body> = { body: Body; museMs: number | null };

const Stored = z.object({ at: z.number(), body: z.unknown(), museMs: z.number().nullable(), live: z.boolean() });

type Held = { at: number; answer: Promise<Answer<SharedBody>> };
const memory = globalThis as typeof globalThis & {
  __headStart?: Map<string, Held>;
  __headStartRecorded?: Map<string, { at: number; body: SharedBody }>;
};
const running = () => (memory.__headStart ??= new Map());
const recordedKept = () => (memory.__headStartRecorded ??= new Map());

const digest = (key: string) => createHash("sha1").update(key).digest("hex").slice(0, 20);
const answerName = (key: string) => `${HEAD_START_PREFIX}${digest(key)}`;
const recordedName = (key: string) => `${HEAD_START_PREFIX}recorded:${digest(key)}`;
const fresh = (at: number, now: number) => now - at < HEAD_START_KEEP_MS;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A live answer: Muse answered and the job kept it. */
export function isLiveAnswer(body: SharedBody | null | undefined): boolean {
  return body?.source === "muse" && body.data != null;
}

/** Forgets this process's answers (the demo reset; the stored copies go with their prefix). */
export function resetHeadStart(): void {
  memory.__headStart?.clear();
  memory.__headStartRecorded?.clear();
}

async function storedAnswer(key: string, now: number): Promise<z.infer<typeof Stored> | null> {
  const stored = await loadState(answerName(key), Stored);
  return stored && fresh(stored.at, now) ? stored : null;
}

/** The one call for `key`: joins the one running or kept here or in the store, or starts it. */
async function sharedCall<Body extends SharedBody>(
  key: string,
  run: () => Promise<Body>,
  now: number,
): Promise<{ answer: Promise<Answer<Body>>; how: HowAnswered }> {
  const held = running().get(key);
  if (held && fresh(held.at, now)) return { answer: held.answer as Promise<Answer<Body>>, how: "joined" };

  const stored = await storedAnswer(key, now);
  if (stored?.live) return { answer: Promise.resolve({ body: stored.body as Body, museMs: stored.museMs }), how: "stored" };

  // Another server instance is already asking: wait for its answer instead of asking twice.
  if (!(await claimOnce(answerName(key), Math.ceil(WAIT_FOR_FIRST_MS / 1000), now))) {
    const until = Date.now() + WAIT_FOR_FIRST_MS;
    while (Date.now() < until) {
      const inProcess = running().get(key);
      if (inProcess && fresh(inProcess.at, now)) return { answer: inProcess.answer as Promise<Answer<Body>>, how: "joined" };
      const first = await storedAnswer(key, now);
      if (first?.live) return { answer: Promise.resolve({ body: first.body as Body, museMs: first.museMs }), how: "stored" };
      // Its call failed: ask Muse here instead.
      if (first && !first.live) break;
      await sleep(POLL_MS * 2);
    }
  }

  const startedAt = performance.now();
  const answer = run().then(async (body): Promise<Answer<Body>> => {
    const live = isLiveAnswer(body);
    // A time the answer already carries (lib/store/shared-answer.ts measured its own call) wins.
    const own = (body as { museMs?: unknown }).museMs;
    const museMs = !live ? null : typeof own === "number" ? own : Math.round(performance.now() - startedAt);
    if (!live) running().delete(key);
    await saveState(answerName(key), { at: now, body, museMs, live });
    return { body, museMs };
  });
  running().set(key, { at: now, answer });
  answer.catch(() => running().delete(key));
  return { answer, how: "started" };
}

/**
 * When the beat this screen belongs to appeared on the stage, for the budget's clock.
 * Null while the stage is still on an earlier beat (the screen was loaded ahead and is
 * held). Without a running stage, or for a screen asked well after its beat (a reload),
 * the clock starts when the request arrived (less a little, for the late asker).
 */
async function beatShownAt(beatId: string | undefined, arrivedAt: number): Promise<number | null> {
  if (!beatId) return arrivedAt;
  const position = await readStagePosition().catch(() => null);
  const target = BEATS.findIndex((beat) => beat.id === beatId);
  if (!position || target < 0) return arrivedAt;
  const movedAt = Date.parse(position.at);
  if (!Number.isFinite(movedAt) || Date.now() - movedAt > STAGE_FRESH_MS) return arrivedAt;
  if (position.index < target && position.index >= target - 2) return null;
  if (position.index !== target) return arrivedAt;
  return Math.max(movedAt, arrivedAt - (ANSWER_BUDGET_MS - LATE_ASKER_MS));
}

/** The live answer if it lands inside the budget, else null. */
async function withinBudget<Body>(
  answer: Promise<Answer<Body>>,
  beatId: string | undefined,
  arrivedAt: number,
  budgetMs: number,
): Promise<Answer<Body> | null> {
  let settled: Answer<Body> | null = null;
  let failed = false;
  answer.then(
    (value) => {
      settled = value;
    },
    () => {
      failed = true;
    },
  );
  await Promise.resolve();
  for (;;) {
    if (settled) return settled;
    if (failed) return null;
    const now = Date.now();
    if (now - arrivedAt >= MAX_HOLD_MS) return null;
    const shownAt = await beatShownAt(beatId, arrivedAt);
    if (shownAt !== null && now >= shownAt + budgetMs) return null;
    await Promise.race([answer.catch(() => null), sleep(shownAt === null ? POLL_MS : Math.min(POLL_MS, shownAt + budgetMs - now))]);
  }
}

/**
 * The answer to one of the demo's slow live questions, shared by everyone who asks
 * it in this run. `key` names the question exactly (the same words, the same clock);
 * `run` asks it; `recorded` is what the screen shows when Muse is not in time (the job
 * run with Muse switched off). A request with the head-start header waits for the
 * live call however long it takes and never counts against the budget.
 */
export async function shareAnswer<Body extends SharedBody>(options: {
  key: string;
  request: Request;
  beatId?: string;
  run: () => Promise<Body>;
  recorded: () => Promise<Body>;
  budgetMs?: number;
}): Promise<{ body: Body & { museMs: number | null }; how: HowAnswered }> {
  const arrivedAt = Date.now();
  const { key, request, beatId, run, recorded, budgetMs = ANSWER_BUDGET_MS } = options;
  const headStart = request.headers.get(HEAD_START_HEADER) === "1";

  if (!headStart) {
    const kept = recordedKept().get(key) ?? (await loadState(recordedName(key), z.object({ at: z.number(), body: z.unknown() })));
    if (kept && fresh(kept.at, arrivedAt)) return { body: { ...(kept.body as Body), museMs: null }, how: "recorded-kept" };
  }

  const { answer, how } = await sharedCall(key, run, arrivedAt);
  if (headStart) {
    const done = await answer;
    return { body: { ...done.body, museMs: done.museMs }, how: "head-start" };
  }

  const live = await withinBudget(answer, beatId, arrivedAt, budgetMs);
  if (live) return { body: { ...live.body, museMs: live.museMs }, how };

  const seconds = Math.round(budgetMs / 1000);
  const body = await withoutMuse(`Muse did not answer within ${seconds} s`, recorded);
  const keep = { at: arrivedAt, body };
  recordedKept().set(key, keep);
  await saveState(recordedName(key), keep);
  return { body: { ...body, museMs: null }, how: "recorded-budget" };
}

/** The flyer read's question: the story's own caption (its times are the run's clock). */
export function storyExtractKey(input: { caption: string; imageBase64?: string; spoken?: boolean }): string | null {
  if (input.spoken || !isStoryCaption(input.caption)) return null;
  return `extract|${input.caption}|${input.imageBase64 ? "flyer" : "caption"}`;
}

/** The walk home's question (no friend, no note), exactly as asked: from, to, the run's clock. */
export function walkHomeKey(input: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  toLabel?: string;
  note?: string;
  at?: string;
  mode?: string;
  exclude?: string[];
}): string | null {
  if (input.note || !input.at || input.toLabel !== WALK_HOME.name) return null;
  const point = (spot: { lat: number; lng: number }) => `${spot.lat},${spot.lng}`;
  return `walk|${point(input.from)}|${point(input.to)}|${input.mode ?? "auto"}|${input.at}|${(input.exclude ?? []).join(",")}`;
}
