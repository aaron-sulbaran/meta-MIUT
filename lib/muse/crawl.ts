import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { isOpenFree } from "@/lib/events/time";
import { walkMinutes } from "@/lib/geo";
import { crawlFixture } from "@/lib/muse/fixtures/crawl";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Food crawl: a walk from where the student is (class) to where they are going (home or a
// friend) through a mix of free stops. Code finds what is on along the way and orders the
// walk; Muse picks the mix (at most one main course), writes the pitch, and drafts the invite.

const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const CrawlInputSchema = z.object({
  from: Point,
  to: Point,
  toLabel: z.string().trim().min(1).max(80).optional(),
  // What the student said, for example "I'm meeting my friend Sara at her dorm".
  note: z.string().trim().max(300).optional(),
});
export type CrawlInput = z.infer<typeof CrawlInputSchema>;

export const STOP_KINDS = ["main", "dessert", "drinks", "snack", "merch", "event"] as const;
export const MAX_STOPS = 4;
export const MAX_DETOUR_MINUTES = 20;
const LOOKAHEAD_MINUTES = 180;
const STOP_MINUTES = 15;
const MINUTE = 60_000;

export const CrawlPickSchema = z.object({
  stops: z.array(z.object({ eventId: z.string().min(1), kind: z.enum(STOP_KINDS) })).max(MAX_STOPS),
  pitch: z.string().min(1).max(160),
  invite: z.object({ eventId: z.string().min(1).nullable(), message: z.string().min(1).max(280) }),
});
export type CrawlPick = z.infer<typeof CrawlPickSchema>;
export type CrawlStopKind = (typeof STOP_KINDS)[number];

export type CrawlStop = {
  eventId: string;
  title: string;
  kind: CrawlStopKind;
  placeName: string;
  lat: number;
  lng: number;
  arriveAt: string;
  walkMinutes: number;
};
export type CrawlPlan = {
  stops: CrawlStop[];
  totalWalkMinutes: number;
  pitch: string;
  // Muse prepares it; the student taps share (WhatsApp, Instagram, text). path opens the event in the app.
  invite: { eventId: string | null; message: string; path: string | null };
};

export const CRAWL_STRUCTURED_OUTPUT = museStructuredOutput("food_crawl", CrawlPickSchema);

// Free events on now or soon whose detour off the straight walk is small, closest first.
export function crawlCandidates(input: CrawlInput, events: CampusEvent[], now: Date): CampusEvent[] {
  const direct = walkMinutes(input.from, input.to);
  return events
    .filter((event) => event.status === "published" && isOpenFree(event))
    .filter((event) => Date.parse(event.end) > now.getTime() + 10 * MINUTE)
    .filter((event) => Date.parse(event.start) <= now.getTime() + LOOKAHEAD_MINUTES * MINUTE)
    .map((event) => ({ event, detour: walkMinutes(input.from, event.place) + walkMinutes(event.place, input.to) - direct }))
    .filter(({ detour }) => detour <= MAX_DETOUR_MINUTES)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 12)
    .map(({ event }) => event);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

// The shortest walk that reaches every stop while it is still on. Stops that cannot fit are dropped.
export function orderStops(
  input: CrawlInput,
  picks: { event: CampusEvent; kind: CrawlStopKind }[],
  now: Date,
): { stops: CrawlStop[]; totalWalkMinutes: number } {
  for (let size = picks.length; size > 0; size--) {
    let best: { stops: CrawlStop[]; total: number } | null = null;
    const subsets = picks.length === size ? [picks] : combinations(picks, size);
    for (const subset of subsets) {
      for (const order of permutations(subset)) {
        let at = now.getTime();
        let here = input.from;
        let total = 0;
        const stops: CrawlStop[] = [];
        let ok = true;
        for (const { event, kind } of order) {
          const walk = walkMinutes(here, event.place);
          total += walk;
          at = Math.max(at + walk * MINUTE, Date.parse(event.start));
          if (at > Date.parse(event.end) - 5 * MINUTE) {
            ok = false;
            break;
          }
          stops.push({ eventId: event.id, title: event.title, kind, placeName: event.place.name, lat: event.place.lat, lng: event.place.lng, arriveAt: new Date(at).toISOString(), walkMinutes: walk });
          at += STOP_MINUTES * MINUTE;
          here = event.place;
        }
        if (!ok) continue;
        total += walkMinutes(here, input.to);
        if (!best || total < best.total) best = { stops, total };
      }
    }
    if (best) return { stops: best.stops, totalWalkMinutes: best.total };
  }
  return { stops: [], totalWalkMinutes: walkMinutes(input.from, input.to) };
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}

export async function planCrawl(input: CrawlInput, events: CampusEvent[], now = new Date()): Promise<MuseJobResult<CrawlPlan>> {
  const candidates = crawlCandidates(input, events, now);
  const byId = new Map(candidates.map((event) => [event.id, event]));
  const listed = candidates.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    food: event.food,
    foodNote: event.foodNote,
    start: event.start,
    end: event.end,
    place: event.place.name,
  }));
  const result = await runMuseJob({
    request: {
      system: [
        "Plan a student's walk after class through free campus stops, as one fun route.",
        `Pick up to ${MAX_STOPS} stops from the list that make a good mix by kind: main (a meal), dessert, drinks, snack, merch (free shirts, swag), or event.`,
        "At most one main. Prefer food first, then dessert or drinks, then merch or an event on the way.",
        'Return JSON only: {"stops":[{"eventId","kind"}],"pitch":"one line under 120 characters, like Out of class and hungry? ...",',
        '"invite":{"eventId": the stop best to share with a friend, or null,"message":"a short text the student sends a friend to join, naming the event, under 200 characters"}}.',
        "Use only ids from the list. If the student mentions a friend, write the invite to that friend. Plain words, no emoji.",
      ].join(" "),
      prompt: `Now: ${now.toISOString()}\nHeading to: ${input.toLabel ?? "home"}\nStudent said: ${input.note ?? "nothing"}\nFree stops on the way: ${JSON.stringify(listed)}`,
      structuredOutput: CRAWL_STRUCTURED_OUTPUT,
    },
    outputSchema: CrawlPickSchema,
    fixture: () => crawlFixture(candidates, input),
    accept: (output) => {
      if (!output.stops.every((stop) => byId.has(stop.eventId))) return "Muse picked an unknown event id";
      if (output.stops.filter((stop) => stop.kind === "main").length > 1) return "Muse picked two main courses";
      if (output.invite.eventId !== null && !byId.has(output.invite.eventId)) return "Muse invited to an unknown event id";
      return null;
    },
  });
  if (result.data === null) return result;
  const picks = result.data.stops.flatMap((stop) => {
    const event = byId.get(stop.eventId);
    return event ? [{ event, kind: stop.kind }] : [];
  });
  const route = orderStops(input, picks, now);
  const inviteId = result.data.invite.eventId ?? route.stops[0]?.eventId ?? null;
  return {
    ...result,
    data: {
      ...route,
      pitch: result.data.pitch,
      invite: { eventId: inviteId, message: result.data.invite.message, path: inviteId ? `/events/${encodeURIComponent(inviteId)}` : null },
    },
  };
}
