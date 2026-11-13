import type { CampusEvent } from "@/lib/events/schema";
import type { CrawlInput, CrawlPick, CrawlStopKind, Itinerary } from "@/lib/muse/crawl";
import type { CrawlPlace } from "@/lib/muse/crawl-places";

// Stand-in when Muse is unavailable: label stops by keywords, one of each kind, at most one main.
const KINDS: [CrawlStopKind, RegExp][] = [
  ["merch", /\b(shirt|t-shirt|merch|swag|tote|sticker)s?\b/i],
  ["dessert", /\b(dessert|boba|bubble tea|ice cream|cookies?|cake|donuts?|mooncake|treats)\b/i],
  ["drinks", /\b(coffee|tea|drinks?|cider|cocoa)\b/i],
  ["main", /\b(pizza|dinner|lunch|tacos|pho|thai|curry|burritos?|sandwich(es)?|bowls?|food)\b/i],
  ["snack", /\b(snacks?|refreshments|chips)\b/i],
];

function kindOf(event: CampusEvent): CrawlStopKind {
  const text = `${event.title} ${event.foodNote ?? ""} ${event.description}`;
  if (!event.food && !KINDS[0]![1].test(text)) return "event";
  return KINDS.find(([, pattern]) => pattern.test(text))?.[0] ?? (event.food ? "snack" : "event");
}

export function crawlFixture(candidates: CampusEvent[], input: CrawlInput): CrawlPick {
  const taken = new Set<CrawlStopKind>();
  const stops: CrawlPick["stops"] = [];
  for (const event of candidates) {
    const kind = kindOf(event);
    if (taken.has(kind) || stops.length >= 4) continue;
    taken.add(kind);
    stops.push({ eventId: event.id, kind });
  }
  const first = candidates.find((event) => event.id === stops[0]?.eventId);
  return {
    stops,
    pitch: stops.length > 0 ? "Out of class and hungry? Here is a free stop or two on your way." : "Nothing free on your way right now.",
    invite: {
      eventId: first?.id ?? null,
      message: first ? `${input.note ? "Want to come with me? " : ""}I'm heading to ${first.title} at ${first.place.name}, it's free. Join me?` : "Want to hang out?",
    },
  };
}

// Stand-in for reading "Harvard, then Baker at 7": known place names in the order said,
// with a time when one follows the name.
export function itineraryFixture(note: string, places: CrawlPlace[]): Itinerary {
  const text = note.toLowerCase();
  const found = places
    .flatMap((place) => {
      const keys = [place.name.toLowerCase(), ...place.aliases];
      const index = Math.min(...keys.map((key) => (text.includes(key) ? text.indexOf(key) : Infinity)));
      return Number.isFinite(index) ? [{ place, index }] : [];
    })
    .sort((a, b) => a.index - b.index)
    .slice(0, 3);
  return {
    places: found.map(({ place, index }, order) => {
      const segment = text.slice(index, found[order + 1]?.index ?? text.length);
      const time = /\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(segment);
      if (!time) return { name: place.name, arriveBy: null };
      let hour = Number(time[1]) % 12;
      if (time[3] !== "am" && hour < 12 && Number(time[1]) <= 11) hour += 12;
      if (time[3] === "am" && Number(time[1]) === 12) hour = 0;
      return { name: place.name, arriveBy: `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}` };
    }),
  };
}
