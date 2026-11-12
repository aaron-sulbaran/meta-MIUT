import "server-only";
import { composeAlert } from "@/lib/alerts/compose";
import { getAlertFeed, type AlertFeed } from "@/lib/alerts/feed";
import { nearbyAlertFor, type NearbyMatch } from "@/lib/alerts/policy";
import type { Alert } from "@/lib/alerts/schema";
import type { CampusEvent, StudentProfile } from "@/lib/events/schema";
import { loadSeedStudent } from "@/lib/events/seed";
import { getEventStore, type EventStore, type StoreResult } from "@/lib/events/store";
import { getInterestMemory, type InterestMemory } from "@/lib/muse/memory";

// Nearby alerts: the student's device reports where they are, and every event
// they would likely care about within a mile sends one alert, once per event.
// Alerts go out through the shared alert feed, so the banner shows them.

type Location = { lat: number; lng: number };

// Who has already been told about which event, keyed by id and start so a
// demo reset (which reseeds new times) alerts again. Kept on globalThis so route
// handlers share it in Next dev (see lib/events/store.ts).
const globalNearby = globalThis as typeof globalThis & { __museNearbySent?: Map<string, Set<string>> };

function sentFor(userId: string): Set<string> {
  globalNearby.__museNearbySent ??= new Map();
  const sent = globalNearby.__museNearbySent.get(userId) ?? new Set<string>();
  globalNearby.__museNearbySent.set(userId, sent);
  return sent;
}

export function resetNearbyAlerts(): void {
  globalNearby.__museNearbySent = new Map();
}

const sentKey = (event: CampusEvent) => `${event.id}@${event.start}`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// One short reason the event suits the student, from the strongest signal.
export function whyNearby(event: CampusEvent, match: NearbyMatch, memory: InterestMemory): string {
  const topics = match.candidate.matched.filter((topic) => !topic.startsWith("@"));
  const remembered = memory.topics.filter((topic) => topics.includes(topic.topic));
  const specific = remembered.find((topic) => topic.topic !== "free food");
  if (specific) return capitalize(specific.hook);
  if (match.candidate.matched.includes(`@${event.organizer.handle}`)) return `You follow ${event.organizer.name}`;
  if (remembered[0]) return capitalize(remembered[0].hook);
  return `You're into ${topics[0] ?? "events like this"}`;
}

export type NearbyCheck = { userId: string; location: Location; now?: Date; profile?: StudentProfile };

export async function checkNearby(
  check: NearbyCheck,
  options: { store?: EventStore; feed?: AlertFeed } = {},
): Promise<StoreResult<{ alerts: Alert[] }>> {
  const now = check.now ?? new Date();
  const profile = check.profile ?? loadSeedStudent();
  const memory = getInterestMemory(check.userId, now);
  const events = await (options.store ?? getEventStore()).listEvents();
  const feed = options.feed ?? getAlertFeed();
  const sent = sentFor(check.userId);

  const matches = events
    .filter((event) => !sent.has(sentKey(event)))
    .flatMap((event) => {
      const match = nearbyAlertFor(event, { profile, memory, location: check.location, now });
      return match ? [{ event, match }] : [];
    })
    .sort((a, b) => b.match.candidate.score - a.match.candidate.score);

  const alerts: Alert[] = [];
  for (const { event, match } of matches) {
    const draft = composeAlert(event, match.kind, {
      now,
      viewerLocation: check.location,
      nearby: { why: whyNearby(event, match, memory) },
    });
    const published = await feed.publish(draft);
    if (published.error !== null) return { data: null, error: published.error };
    sent.add(sentKey(event));
    alerts.push(published.data);
  }
  return { data: { alerts }, error: null };
}

