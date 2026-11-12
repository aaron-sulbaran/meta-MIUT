import type { InstagramSignal } from "@/lib/muse/memory";

// PLACEHOLDER Instagram activity for the seeded sample student, invented for
// the demo. Times are relative to load so the memory never looks stale.
type SeedSignal = Omit<InstagramSignal, "at"> & { hoursAgo: number };

const SEED: SeedSignal[] = [
  { kind: "watch", hoursAgo: 2, topics: ["rock climbing"], creator: "sample_climbing", watchSeconds: 58, videoSeconds: 30 },
  { kind: "watch", hoursAgo: 20, topics: ["rock climbing"], creator: "sample_climbing", watchSeconds: 28, videoSeconds: 30 },
  { kind: "like", hoursAgo: 20, topics: ["rock climbing"], creator: "sample_climbing" },
  { kind: "save", hoursAgo: 44, topics: ["rock climbing", "fitness"], creator: "sample_climbing" },
  { kind: "watch", hoursAgo: 5, topics: ["hackathons", "coding"], creator: "sample_makers", watchSeconds: 45, videoSeconds: 45 },
  { kind: "comment", hoursAgo: 5, topics: ["hackathons"], creator: "sample_makers", text: "who is going to build night??" },
  { kind: "like", hoursAgo: 30, topics: ["coding"], creator: "sample_cs_club" },
  { kind: "watch", hoursAgo: 8, topics: ["free food"], creator: "sample_student_gov", watchSeconds: 15, videoSeconds: 15 },
  { kind: "like", hoursAgo: 8, topics: ["free food"], creator: "sample_student_gov" },
  { kind: "share", hoursAgo: 70, topics: ["free food"] },
  { kind: "watch", hoursAgo: 26, topics: ["film"], creator: "sample_film", watchSeconds: 40, videoSeconds: 60 },
  { kind: "like", hoursAgo: 96, topics: ["film"], creator: "sample_film" },
  { kind: "watch", hoursAgo: 3, topics: ["yoga", "wellness"], creator: "sample_wellness", watchSeconds: 2, videoSeconds: 30 },
  { kind: "watch", hoursAgo: 50, topics: ["yoga"], creator: "sample_wellness", watchSeconds: 3, videoSeconds: 25 },
  { kind: "watch", hoursAgo: 12, topics: ["music"], creator: "sample_orchestra", watchSeconds: 4, videoSeconds: 40 },
];

export function seedSignals(now: Date): InstagramSignal[] {
  return SEED.map(({ hoursAgo, ...signal }) => ({
    ...signal,
    at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  }));
}
