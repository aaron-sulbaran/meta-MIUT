import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { isOpenFree } from "@/lib/events/time";
import { distanceMeters } from "@/lib/geo";
import {
  MINUTE,
  orderLeg,
  STOP_KINDS,
  travel,
  TRAVEL_MODES,
  type CrawlMode,
  type CrawlStop,
  type Pick,
  type Point,
  type TravelMode,
} from "@/lib/crawl/order";
import { CRAWL_PLACES, type CrawlPlace } from "@/lib/muse/crawl-places";
import { storyCrawlFixture } from "@/lib/demo/story-fixtures";
import { crawlFixture, itineraryFixture } from "@/lib/muse/fixtures/crawl";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";

// Food crawl: a walk from where the student is (class) to where they are going (home or a
// friend) through a mix of free stops. Code finds what is on along the way and orders the
// walk; Muse picks the mix (at most one main course), writes the pitch, and drafts the invite.

const PointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export { orderLeg, STOP_KINDS, travel, TRAVEL_MODES } from "@/lib/crawl/order";
export type { CrawlMode, CrawlStop, CrawlStopKind, TravelMode } from "@/lib/crawl/order";

export const CrawlInputSchema = z.object({
  from: PointSchema,
  to: PointSchema,
  toLabel: z.string().trim().min(1).max(80).optional(),
  // What the student said, for example "I'm meeting my friend Sara at her dorm".
  note: z.string().trim().max(300).optional(),
  // When the walk starts, for planning ahead ("after my 5 PM class"). Defaults to now.
  at: z.iso.datetime({ offset: true }).optional(),
  // How to get between places. auto walks short hops and takes the T past a 20 minute walk.
  mode: z.enum(["auto", "walk", "transit", "drive"]).optional(),
  // Event ids the student hid (Not for me); they never become stops.
  exclude: z.array(z.string().min(1)).max(500).optional(),
});
export type CrawlInput = z.infer<typeof CrawlInputSchema>;

export const MAX_STOPS = 4;
export const MAX_DETOUR_MINUTES = 20;
// Stops stay in the area between where the student is and where they are going: the extra
// distance off the straight line is at most 1 km, or 40% of the trip for a long one. A walk
// inside MIT never reaches Harvard or BU.
const AREA_MIN_EXTRA_METERS = 1000;
const AREA_EXTRA_SHARE = 0.4;
// Each leg, stops included, gets the student to the next place within an hour.
export const MAX_LEG_MINUTES = 60;
const LOOKAHEAD_MINUTES = 180;

export const CrawlPickSchema = z.object({
  stops: z.array(z.object({ eventId: z.string().min(1), kind: z.enum(STOP_KINDS) })).max(MAX_STOPS),
  pitch: z.string().min(1).max(160),
  invite: z.object({ eventId: z.string().min(1).nullable(), message: z.string().min(1).max(280) }),
});
export type CrawlPick = z.infer<typeof CrawlPickSchema>;

export type CrawlPlan = {
  // Free stops and the places the student named, in walking order. The walk ends at destination.
  stops: CrawlStop[];
  destination: { name: string; lat: number; lng: number; arriveAt: string; walkMinutes: number; mode: TravelMode };
  // Minutes on the move, any mode.
  totalWalkMinutes: number;
  pitch: string;
  // Muse prepares it; the student taps share (WhatsApp, Instagram, text). path opens the event in the app.
  invite: { eventId: string | null; message: string; path: string | null };
};

export const CRAWL_STRUCTURED_OUTPUT = museStructuredOutput("food_crawl", CrawlPickSchema);
const CrawlWordsSchema = CrawlPickSchema.omit({ stops: true });
const CRAWL_WORDS_STRUCTURED_OUTPUT = museStructuredOutput("food_crawl_words", CrawlWordsSchema);


export function inCrawlArea(from: Point, to: Point, place: Point): boolean {
  const direct = distanceMeters(from, to);
  const extra = distanceMeters(from, place) + distanceMeters(place, to) - direct;
  return extra <= Math.max(AREA_MIN_EXTRA_METERS, AREA_EXTRA_SHARE * direct);
}

const legDeadline = (startMs: number, deadline: number | null) =>
  Math.min(deadline ?? Infinity, startMs + MAX_LEG_MINUTES * MINUTE);

// Free events on now or soon, inside the area of the trip, whose detour is small, closest first.
export function crawlCandidates(
  input: { from: Point; to: Point },
  events: CampusEvent[],
  now: Date,
  mode: CrawlMode = "walk",
): CampusEvent[] {
  const minutes = (a: Point, b: Point) => travel(a, b, mode).minutes;
  const direct = minutes(input.from, input.to);
  return events
    .filter((event) => event.status === "published" && isOpenFree(event))
    .filter((event) => Date.parse(event.end) > now.getTime() + 10 * MINUTE)
    .filter((event) => Date.parse(event.start) <= now.getTime() + LOOKAHEAD_MINUTES * MINUTE)
    .filter((event) => inCrawlArea(input.from, input.to, event.place))
    .map((event) => ({ event, detour: minutes(input.from, event.place) + minutes(event.place, input.to) - direct }))
    .filter(({ detour }) => detour <= MAX_DETOUR_MINUTES)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 12)
    .map(({ event }) => event);
}




export function orderStops(input: CrawlInput, picks: Pick[], now: Date): { stops: CrawlStop[]; totalWalkMinutes: number } {
  const leg = orderLeg(input.from, input.to, picks, now.getTime());
  return { stops: leg.stops, totalWalkMinutes: leg.walkMinutes };
}


const campusClock = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit" });

// What the student said, as the places they will go in order, each with an optional arrive-by time.
export const ItinerarySchema = z.object({
  places: z
    .array(z.object({ name: z.string().min(1), arriveBy: z.string().regex(/^\d{2}:\d{2}$/).nullable() }))
    .max(3),
  // How they said they will get around, or null.
  mode: z.enum(TRAVEL_MODES).nullable(),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;
export const ITINERARY_STRUCTURED_OUTPUT = museStructuredOutput("crawl_itinerary", ItinerarySchema);

const WAYPOINT_MINUTES = 30;

function campusTimeOn(day: Date, hhmm: string): number {
  const date = day.toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE });
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(day)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return Date.parse(`${date}T${hhmm}:00${offset}`);
}

export function crawlPlaces(input: CrawlInput, events: CampusEvent[]): CrawlPlace[] {
  const places = [...CRAWL_PLACES];
  if (input.toLabel) places.push({ name: input.toLabel, lat: input.to.lat, lng: input.to.lng, aliases: [] });
  for (const event of events) {
    if (!places.some((place) => place.name === event.place.name)) {
      places.push({ name: event.place.name, lat: event.place.lat, lng: event.place.lng, aliases: [] });
    }
  }
  return places;
}

async function readItinerary(input: CrawlInput, places: CrawlPlace[], now: Date) {
  const names = new Set(places.map((place) => place.name));
  return runMuseJob({
    request: {
      system: [
        "A student is planning where to go after class and told you where they are going.",
        "List the places they will go, in order, using only names from the list. End with the last place they mention.",
        "Their messages come oldest first. When a later message changes the plan (a new end, a new friend's place), follow the latest one and drop places it replaces.",
        "Only add their original destination if they say they go back there. arriveBy is a 24-hour campus time like 19:00 if they say one, else null.",
        'mode: only when they say how they will get there: "transit" for the T, subway, bus, or train; "drive" for driving, a car, Uber, or Lyft; "walk" if they say they want to walk. Otherwise null.',
        'Return JSON only: {"places":[{"name","arriveBy"}],"mode"}. Return an empty list if they name no place.',
      ].join(" "),
      prompt: `Now: ${campusClock(now.toISOString())}\nOriginal destination: ${input.toLabel ?? "home"}\nStudent said: ${input.note}\nPlaces: ${JSON.stringify(places.map((place) => place.name))}`,
      structuredOutput: ITINERARY_STRUCTURED_OUTPUT,
    },
    outputSchema: ItinerarySchema,
    fixture: () => itineraryFixture(input.note ?? "", places),
    accept: (output) => (output.places.every((place) => names.has(place.name)) ? null : "Muse named a place not on the list"),
  });
}

export async function planCrawl(input: CrawlInput, events: CampusEvent[], now = new Date()): Promise<MuseJobResult<CrawlPlan>> {
  // The legs: class, then each place the student named, ending at the destination.
  const places = crawlPlaces(input, events);
  const itinerary = input.note ? await readItinerary(input, places, now) : null;
  const named = (itinerary?.data?.places ?? []).flatMap((item) => {
    const place = places.find((candidate) => candidate.name === item.name);
    if (!place) return [];
    let deadline = item.arriveBy ? campusTimeOn(now, item.arriveBy) : null;
    if (deadline !== null && deadline < now.getTime()) deadline += 12 * 60 * MINUTE;
    return [{ name: place.name, lat: place.lat, lng: place.lng, deadline }];
  });
  const mode: CrawlMode = input.mode ?? itinerary?.data?.mode ?? "auto";
  const ends: { name: string; lat: number; lng: number; deadline: number | null }[] =
    named.length > 0 ? named : [{ name: input.toLabel ?? "Home", ...input.to, deadline: null }];
  // A later "by 7" also bounds the legs before it, leaving time to walk on.
  for (let leg = ends.length - 2; leg >= 0; leg--) {
    const next = ends[leg + 1]!;
    if (next.deadline === null) continue;
    const latest = next.deadline - travel(ends[leg]!, next, mode).minutes * MINUTE;
    const own = ends[leg]!.deadline;
    ends[leg]!.deadline = own === null ? latest : Math.min(own, latest);
  }

  const legOf = new Map<string, number>();
  const candidates: CampusEvent[] = [];
  let legStart: Point = input.from;
  // The earliest each leg can start, to skip stops that could never fit before a "by" time.
  let earliest = now.getTime();
  ends.forEach((end, leg) => {
    for (const event of crawlCandidates({ from: legStart, to: end }, events, now, mode)) {
      if (legOf.has(event.id) || input.exclude?.includes(event.id)) continue;
      const deadline = legDeadline(earliest, end.deadline);
      if (orderLeg(legStart, end, [{ event, kind: "event" }], earliest, deadline, mode).stops.length === 0) continue;
      legOf.set(event.id, leg);
      candidates.push(event);
    }
    earliest += travel(legStart, end, mode).minutes * MINUTE;
    legStart = end;
  });
  const byId = new Map(candidates.map((event) => [event.id, event]));
  const listed = candidates.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    food: event.food,
    foodNote: event.foodNote,
    // Campus clock times, so the invite says "until 10 PM", not a UTC hour.
    start: campusClock(event.start),
    end: campusClock(event.end),
    place: event.place.name,
    onTheWayTo: ends[legOf.get(event.id) ?? 0]?.name,
  }));
  const route = ends
    .map((end, leg) => {
      const by = travel(leg === 0 ? input.from : ends[leg - 1]!, end, mode).mode;
      return `${end.name} (${by}${end.deadline ? `, by ${campusClock(new Date(end.deadline).toISOString())}` : ""})`;
    })
    .join(", then ");
  const result = await runMuseJob({
    request: {
      system: [
        "Plan a student's walk after class through free campus stops, as one fun route.",
        `Pick up to ${MAX_STOPS} stops from the list that make a good mix by kind: main (a meal), dessert, drinks, snack, merch (free shirts, swag), or event.`,
        "At most one main. Prefer food first, then dessert or drinks, then merch or an event on the way.",
        "Respect what the student said, for example skip a kind they do not want.",
        'Return JSON only: {"stops":[{"eventId","kind"}],"pitch":"one line under 120 characters, like Out of class and hungry? ...",',
        "List stops in the order to visit them, and name them in that order in the pitch.",
        '"invite":{"eventId": the stop best to share with a friend, or null,"message":"a short text the student sends a friend to join, naming the event, under 200 characters"}}.',
        "Use only ids from the list. If the student mentions a friend, write the invite to that friend. Plain words, no emoji.",
      ].join(" "),
      prompt: `Now: ${campusClock(now.toISOString())}\nRoute: ${route}\nStudent said: ${input.note ?? "nothing"}\nFree stops on the way: ${JSON.stringify(listed)}`,
      structuredOutput: CRAWL_STRUCTURED_OUTPUT,
    },
    outputSchema: CrawlPickSchema,
    // A walk to the demo story's event keeps it as a stop and invites to it.
    fixture: () => {
      const generic = crawlFixture(candidates, input);
      return storyCrawlFixture(generic, candidates, input) ?? generic;
    },
    accept: (output) => {
      if (!output.stops.every((stop) => byId.has(stop.eventId))) return "Muse picked an unknown event id";
      if (output.stops.filter((stop) => stop.kind === "main").length > 1) return "Muse picked two main courses";
      if (output.invite.eventId !== null && !byId.has(output.invite.eventId)) return "Muse invited to an unknown event id";
      return null;
    },
  });
  if (result.data === null) return result;

  const stops: CrawlStop[] = [];
  let finalLeg = { minutes: 0, mode: "walk" as TravelMode };
  let walk = 0;
  let at = now.getTime();
  let here: Point = input.from;
  ends.forEach((end, leg) => {
    const picks = result.data.stops.flatMap((stop) => {
      const event = byId.get(stop.eventId);
      return event && legOf.get(event.id) === leg ? [{ event, kind: stop.kind }] : [];
    });
    const ordered = orderLeg(here, end, picks, at, legDeadline(at, end.deadline), mode);
    stops.push(...ordered.stops);
    walk += ordered.walkMinutes;
    const fromLast = ordered.stops.at(-1) ?? null;
    finalLeg = { minutes: travel(fromLast ?? here, end, mode).minutes, mode: ordered.lastMode };
    at = ordered.arriveMs;
    if (leg < ends.length - 1) {
      stops.push({ eventId: null, title: end.name, kind: "plan", placeName: end.name, lat: end.lat, lng: end.lng, arriveAt: new Date(at).toISOString(), walkMinutes: travel(fromLast ?? here, end, mode).minutes, mode: ordered.lastMode });
      // Stay a while, but leave in time for the next place's "by" time.
      const next = ends[leg + 1]!;
      const leaveBy = next.deadline === null ? Infinity : next.deadline - travel(end, next, mode).minutes * MINUTE;
      at = Math.max(at, Math.min(at + WAYPOINT_MINUTES * MINUTE, leaveBy));
    }
    here = end;
  });
  const last = ends[ends.length - 1]!;
  const words = await wordCrawl(input, result.data, stops, byId, route);
  const firstStop = stops.find((stop) => stop.eventId !== null)?.eventId ?? null;
  const inviteId = words.invite.eventId ?? firstStop;
  return {
    ...result,
    data: {
      stops,
      destination: { name: last.name, lat: last.lat, lng: last.lng, arriveAt: new Date(at).toISOString(), walkMinutes: finalLeg.minutes, mode: finalLeg.mode },
      totalWalkMinutes: walk,
      pitch: words.pitch,
      invite: { eventId: inviteId, message: words.invite.message, path: inviteId ? `/events/${encodeURIComponent(inviteId)}` : null },
    },
  };
}

// Muse's pitch names the stops it picked, in its order. When the walk keeps a different set or
// order (a stop did not fit the time), or weaves in places the student named, Muse rewords the
// pitch and invite for the real route.
async function wordCrawl(
  input: CrawlInput,
  pick: CrawlPick,
  stops: CrawlStop[],
  byId: Map<string, CampusEvent>,
  route: string,
): Promise<z.infer<typeof CrawlWordsSchema>> {
  const walked = stops.flatMap((stop) => (stop.eventId === null ? [] : [stop.eventId]));
  const namedPlaces = stops.some((stop) => stop.kind === "plan");
  if (!namedPlaces && walked.join() === pick.stops.map((stop) => stop.eventId).join()) return pick;
  const kept = walked.flatMap((id) => {
    const event = byId.get(id);
    return event ? [event] : [];
  });
  // The demo story's walk keeps its own invite in the recorded words too.
  const fallback = () => {
    const generic = crawlFixture(kept, input);
    return storyCrawlFixture(generic, kept, input) ?? generic;
  };
  const result = await runMuseJob({
    request: {
      system: [
        "Write the line for a student's walk after class through free campus stops, already planned.",
        'Return JSON only: {"pitch":"one line under 120 characters, like Out of class and hungry? ..., naming the stops in the order given",',
        '"invite":{"eventId": the stop best to share with a friend, or null,"message":"a short text the student sends a friend to join, naming the event, under 200 characters"}}.',
        "Use only ids from the list. If the student mentions a friend, write the invite to that friend. Plain words, no emoji.",
      ].join(" "),
      prompt: `Route: ${route}\nStudent said: ${input.note ?? "nothing"}\nStops in walking order: ${JSON.stringify(
        stops.map((stop) => ({ id: stop.eventId, title: stop.title, kind: stop.kind, at: campusClock(stop.arriveAt), by: stop.mode })),
      )}`,
      structuredOutput: CRAWL_WORDS_STRUCTURED_OUTPUT,
    },
    outputSchema: CrawlWordsSchema,
    fixture: fallback,
    accept: (output) =>
      output.invite.eventId !== null && !walked.includes(output.invite.eventId) ? "Muse invited to a stop not on the walk" : null,
  });
  return result.data ?? fallback();
}
