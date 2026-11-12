import { z } from "zod";
import { seedSignals } from "@/lib/muse/fixtures/signals";

// Interest memory: what a student's Instagram activity says they care about.
// Signals are raw interactions (how long they watched, likes, comments, saves,
// shares). buildInterestMemory folds them into topic and creator scores from
// 0 to 1 that rank uses. Demo data only; nothing reads the Instagram API.

export const SIGNAL_KINDS = ["watch", "like", "comment", "save", "share"] as const;

export const InstagramSignalSchema = z.object({
  kind: z.enum(SIGNAL_KINDS),
  at: z.iso.datetime({ offset: true }),
  topics: z.array(z.string().trim().toLowerCase().min(1)).min(1).max(5),
  creator: z.string().min(1).optional(),
  watchSeconds: z.number().nonnegative().optional(),
  videoSeconds: z.number().positive().optional(),
  text: z.string().max(500).optional(),
});

export type InstagramSignal = z.infer<typeof InstagramSignalSchema>;

export type TopicInterest = {
  topic: string;
  score: number;
  // Plain summary of the behavior behind the score, for the model and the UI.
  evidence: string;
  // The strongest behavior as a clause, for a pick's reason line.
  hook: string;
};

export type CreatorAffinity = { handle: string; score: number };

export type InterestMemory = {
  userId: string;
  signalCount: number;
  topics: TopicInterest[];
  creators: CreatorAffinity[];
};

export const DEMO_USER_ID = "sample-student";

const DAY = 86_400_000;
const HALF_LIFE_DAYS = 14;
const QUICK_SKIP_RATIO = 0.25;
const FULL_WATCH_RATIO = 0.8;
const MAX_SIGNALS_PER_USER = 500;

// Dwell time is the main signal: a reel watched to the end or rewatched counts
// more than a like, and a quick skip counts against the topic.
export function signalWeight(signal: InstagramSignal): number {
  switch (signal.kind) {
    case "watch": {
      if (signal.watchSeconds === undefined || signal.videoSeconds === undefined) return 0.5;
      const ratio = signal.watchSeconds / signal.videoSeconds;
      return ratio < QUICK_SKIP_RATIO ? -0.5 : Math.min(ratio, 2);
    }
    case "like":
      return 1;
    case "comment":
      return 2;
    case "save":
      return 2.5;
    case "share":
      return 2;
  }
}

function recencyFactor(signal: InstagramSignal, now: Date): number {
  const ageDays = Math.max(0, now.getTime() - Date.parse(signal.at)) / DAY;
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

type Tally = { raw: number; fullWatches: number; likes: number; comments: number; saves: number; shares: number };

function isFullWatch(signal: InstagramSignal): boolean {
  if (signal.kind !== "watch" || signal.watchSeconds === undefined || signal.videoSeconds === undefined) return false;
  return signal.watchSeconds / signal.videoSeconds >= FULL_WATCH_RATIO;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function describe(topic: string, tally: Tally): { evidence: string; hook: string } {
  const parts: string[] = [];
  if (tally.fullWatches > 0) parts.push(`watched ${plural(tally.fullWatches, "video")} to the end`);
  if (tally.comments > 0) parts.push(`commented on ${plural(tally.comments, "post")}`);
  if (tally.saves > 0) parts.push(`saved ${plural(tally.saves, "post")}`);
  if (tally.shares > 0) parts.push(`shared ${plural(tally.shares, "post")}`);
  if (tally.likes > 0) parts.push(`liked ${plural(tally.likes, "post")}`);
  const evidence = parts.length > 0 ? `${topic}: ${parts.join(", ")}` : `${topic}: some engagement`;
  const hook =
    tally.comments > 0
      ? `you comment on ${topic} posts`
      : tally.fullWatches > 0
        ? `you watch ${topic} videos to the end`
        : tally.saves > 0
          ? `you save ${topic} posts`
          : tally.shares > 0
            ? `you share ${topic} posts`
            : `you like ${topic} posts`;
  return { evidence, hook };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildInterestMemory(userId: string, signals: InstagramSignal[], now = new Date()): InterestMemory {
  const topics = new Map<string, Tally>();
  const creators = new Map<string, number>();

  for (const signal of signals) {
    const weight = signalWeight(signal) * recencyFactor(signal, now);
    for (const topic of signal.topics) {
      const tally = topics.get(topic) ?? { raw: 0, fullWatches: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
      tally.raw += weight;
      if (isFullWatch(signal)) tally.fullWatches += 1;
      if (signal.kind === "like") tally.likes += 1;
      if (signal.kind === "comment") tally.comments += 1;
      if (signal.kind === "save") tally.saves += 1;
      if (signal.kind === "share") tally.shares += 1;
      topics.set(topic, tally);
    }
    if (signal.creator) creators.set(signal.creator, (creators.get(signal.creator) ?? 0) + weight);
  }

  const topTopic = Math.max(0, ...[...topics.values()].map((tally) => tally.raw));
  const topCreator = Math.max(0, ...creators.values());

  return {
    userId,
    signalCount: signals.length,
    topics: [...topics.entries()]
      .filter(([, tally]) => tally.raw > 0)
      .map(([topic, tally]) => ({ topic, score: round2(tally.raw / topTopic), ...describe(topic, tally) }))
      .sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic)),
    creators: [...creators.entries()]
      .filter(([, raw]) => raw > 0)
      .map(([handle, raw]) => ({ handle, score: round2(raw / topCreator) }))
      .sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle)),
  };
}

// Per-process memory, kept on globalThis like the event store so route
// handlers and pages share it in dev. Unknown users start empty and rank from
// their stated interests and follows until signals arrive.
type SignalLog = Map<string, InstagramSignal[]>;
const globalMemory = globalThis as typeof globalThis & { __interestSignals?: SignalLog };

function signalLog(now: Date): SignalLog {
  globalMemory.__interestSignals ??= new Map([[DEMO_USER_ID, seedSignals(now)]]);
  return globalMemory.__interestSignals;
}

export function signalsFor(userId: string, now = new Date()): InstagramSignal[] {
  return signalLog(now).get(userId) ?? [];
}

export function recordSignals(userId: string, signals: InstagramSignal[], now = new Date()): InterestMemory {
  const log = signalLog(now);
  const parsed = signals.map((signal) => InstagramSignalSchema.parse(signal));
  log.set(userId, [...(log.get(userId) ?? []), ...parsed].slice(-MAX_SIGNALS_PER_USER));
  return getInterestMemory(userId, now);
}

export function getInterestMemory(userId = DEMO_USER_ID, now = new Date()): InterestMemory {
  return buildInterestMemory(userId, signalsFor(userId, now), now);
}

export function resetInterestMemory(): void {
  delete globalMemory.__interestSignals;
}
