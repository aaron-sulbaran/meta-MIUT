import type { CampusEvent } from "@/lib/events/schema";
import type { CrawlInput, CrawlPick, CrawlStopKind } from "@/lib/muse/crawl";

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
