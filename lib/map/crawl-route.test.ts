import { describe, expect, it } from "vitest";
import {
  STOP_MINUTES,
  arrivesTooLate,
  googleDirectionsUrl,
  insertStop,
  removeStop,
  retime,
  type Route,
  type RouteStop,
} from "@/lib/map/crawl-route";

const start = Date.parse("2026-11-12T22:00:00.000Z");
const stata = { lat: 42.3616, lng: -71.0906 };
const maseeh = { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934, arriveAt: "", walkMinutes: 0, mode: "walk" as const };

function stop(eventId: string, lat: number, lng: number, extra: Partial<RouteStop> = {}): RouteStop {
  return { eventId, title: eventId, kind: "snack", placeName: eventId, lat, lng, endsAt: null, startsAt: null, arriveAt: "", walkMinutes: 0, mode: "walk", ...extra };
}

const base: Route = {
  from: stata,
  stops: [stop("a", 42.3601, -71.0913), stop("b", 42.3588, -71.0925)],
  destination: maseeh,
  totalWalkMinutes: 0,
};

describe("crawl route", () => {
  it("re-times every hop from the start, with time at each stop", () => {
    const route = retime(base, start);
    const [first, second] = route.stops;
    expect(Date.parse(first!.arriveAt)).toBe(start + first!.walkMinutes * 60_000);
    expect(Date.parse(second!.arriveAt)).toBe(Date.parse(first!.arriveAt) + (STOP_MINUTES + second!.walkMinutes) * 60_000);
    expect(route.totalWalkMinutes).toBe(first!.walkMinutes + second!.walkMinutes + route.destination.walkMinutes);
  });

  it("waits for an event that has not started yet", () => {
    const later = "2026-11-12T23:00:00.000Z";
    const route = retime({ ...base, stops: [stop("a", 42.3601, -71.0913, { startsAt: later })] }, start);
    expect(route.stops[0]!.arriveAt).toBe(later);
  });

  it("removes a stop and keeps the rest in order", () => {
    const route = removeStop(retime(base, start), 0, start);
    expect(route.stops.map((item) => item.eventId)).toEqual(["b"]);
  });

  it("inserts a new stop where it adds the least walking", () => {
    const between = stop("mid", 42.3595, -71.0919);
    const route = insertStop(retime(base, start), between, start);
    expect(route.stops.map((item) => item.eventId)).toEqual(["a", "mid", "b"]);
  });

  it("flags a stop reached after its event ends", () => {
    const ends = new Date(start + 2 * 60_000).toISOString();
    const route = retime({ ...base, stops: [stop("b", 42.3588, -71.0925, { endsAt: ends })] }, start);
    expect(arrivesTooLate(route.stops[0]!)).toBe(true);
  });

  it("builds Google Maps directions through every stop", () => {
    const url = new URL(googleDirectionsUrl(retime(base, start)));
    expect(url.searchParams.get("origin")).toBe("42.3616,-71.0906");
    expect(url.searchParams.get("destination")).toBe("42.3575,-71.0934");
    expect(url.searchParams.get("waypoints")).toBe("42.3601,-71.0913|42.3588,-71.0925");
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });
});
