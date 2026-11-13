import "server-only";
import { z } from "zod";
import { curateFixtureFeed } from "@/lib/curate/curate";
import { pickStoryEvent } from "@/lib/demo/story";
import type { CampusEvent } from "@/lib/events/schema";
import { readRedisConfig } from "@/lib/store/redis";
import { loadState, saveState } from "@/lib/store/state";

// A viewer's own curated feed, kept after their first-visit curate call so the
// Events list's Top 3 shows their picks instead of the sample student's (the
// cohesion audit's item 2a). Kept in the shared store; the demo reset clears the prefix.

export const CURATE_PICKS_PREFIX = "curate-picks:";

export const ViewerPicksSchema = z.object({
  at: z.number(),
  summary: z.string(),
  eventIds: z.array(z.string()).min(1),
  source: z.enum(["muse", "fixture"]),
  // The real Muse call's time in ms; null for a recorded answer.
  museMs: z.number().nullable(),
});
export type ViewerPicks = z.infer<typeof ViewerPicksSchema>;

// Without the shared store, kept in this process instead (on globalThis: route handlers and
// pages are separate module graphs in dev). With it, the store is the only copy, so a reset
// on one server instance is seen by every other.
const memory = globalThis as typeof globalThis & { __viewerPicks?: Map<string, ViewerPicks> };
const held = () => (memory.__viewerPicks ??= new Map());

export async function saveViewerPicks(viewerId: string, picks: ViewerPicks): Promise<void> {
  if (readRedisConfig() === null) held().set(viewerId, picks);
  else await saveState(`${CURATE_PICKS_PREFIX}${viewerId}`, picks);
}

export async function loadViewerPicks(viewerId: string): Promise<ViewerPicks | null> {
  if (readRedisConfig() === null) return held().get(viewerId) ?? null;
  return loadState(`${CURATE_PICKS_PREFIX}${viewerId}`, ViewerPicksSchema).catch(() => null);
}

/** Forgets this process's picks (the demo reset; the stored copies go with their prefix). */
export function resetViewerPicks(): void {
  memory.__viewerPicks?.clear();
}

/** What the Events list's Top 3 shows for a viewer with their own curated feed. */
export type OwnTopPicks = ViewerPicks & { recordedFallback: boolean };

/**
 * The viewer's own Top 3 for the Events list: their kept curate answer, its events
 * still listed and not over. `firstVisit` (the onboarding's List, ?first=1) never shows
 * someone else's picks: with no answer kept, it shows the story's recorded feed, labeled.
 */
export async function ownTopPicks(
  viewerId: string,
  events: CampusEvent[],
  now: Date,
  firstVisit: boolean,
): Promise<OwnTopPicks | null> {
  const listed = new Set(events.filter((event) => Date.parse(event.end) > now.getTime()).map((event) => event.id));
  const kept = await loadViewerPicks(viewerId);
  const eventIds = kept?.eventIds.filter((id) => listed.has(id)) ?? [];
  if (kept && eventIds.length > 0) return { ...kept, eventIds, recordedFallback: false };
  if (!firstVisit) return null;
  const recorded = curateFixtureFeed(events, pickStoryEvent(events)?.id ?? null, now, "No curate answer kept");
  if (!recorded.data || recorded.data.picks.length === 0) return null;
  return {
    at: now.getTime(),
    summary: recorded.data.summary,
    eventIds: recorded.data.picks.map((pick) => pick.eventId),
    source: "fixture",
    museMs: null,
    recordedFallback: true,
  };
}
