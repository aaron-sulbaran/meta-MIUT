import type { NextRequest } from "next/server";
import { z } from "zod";
import { distanceMeters } from "@/lib/geo";
import { readPlace } from "@/lib/muse/place";

// GET ?q=<place>&lat=&lng=: where a crawl should end, for whatever the student typed.
// Muse fixes typos and turns "a taco shop" into "tacos", then OpenStreetMap search (no key)
// finds it and the closest match to the student wins.
// Returns { data: { name, lat, lng } | null, tooFar: string | null } (tooFar: why it is not reachable).

const MIT = { lat: 42.3601, lng: -71.0942 };
const AROUND_CAMPUS = "-71.20,42.43,-70.98,42.30";
// Past this a walk or a T ride from campus stops making sense.
const MAX_METERS = 16_000;
const HEADERS = { "user-agent": "meta-MIUT hackathon demo", "accept-language": "en" };

type Found = { name: string; lat: number; lng: number };

const NominatimSchema = z.array(
  z.object({ lat: z.string(), lon: z.string(), name: z.string().optional(), display_name: z.string() }),
);
const PhotonSchema = z.object({
  features: z.array(
    z.object({ geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }), properties: z.object({ name: z.string().optional() }) }),
  ),
});

async function nominatim(q: string): Promise<Found[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "5", viewbox: AROUND_CAMPUS, bounded: "1" }).toString();
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
  const parsed = NominatimSchema.safeParse(await response.json());
  if (!parsed.success) return [];
  return parsed.data.map((hit) => ({ name: hit.name || hit.display_name.split(",")[0] || q, lat: Number(hit.lat), lng: Number(hit.lon) }));
}

// Photon forgives spelling ("boston comon") and ranks results near the student first.
async function photon(q: string, near: { lat: number; lng: number }): Promise<Found[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({ q, limit: "5", lat: String(near.lat), lon: String(near.lng), lang: "en" }).toString();
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
  const parsed = PhotonSchema.safeParse(await response.json());
  if (!parsed.success) return [];
  return parsed.data.features.map((hit) => ({
    name: hit.properties.name ?? q,
    lat: hit.geometry.coordinates[1],
    lng: hit.geometry.coordinates[0],
  }));
}

const miles = (meters: number) => Math.round(meters / 1609);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim().slice(0, 120) ?? "";
  if (!q) return Response.json({ data: null, tooFar: null, error: "Type a place" }, { status: 400 });
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : MIT;

  const read = await readPlace(q);
  if (read.data && !read.data.reachable) {
    return Response.json({ data: null, tooFar: read.data.reason || `${q} is too far for a walk from campus.`, error: null });
  }
  const query = read.data?.query || q;
  try {
    let hits = await nominatim(query);
    if (hits.length === 0 && query !== q) hits = await nominatim(q);
    if (hits.length === 0) hits = await photon(query, near);
    const best = hits
      .map((hit) => ({ hit, meters: distanceMeters(near, hit) }))
      .sort((a, b) => a.meters - b.meters)[0];
    if (!best) return Response.json({ data: null, tooFar: null, error: null });
    if (best.meters > MAX_METERS) {
      return Response.json({ data: null, tooFar: `${best.hit.name} is about ${miles(best.meters)} miles away, too far for a walk.`, error: null });
    }
    return Response.json({ data: best.hit, tooFar: null, error: null });
  } catch {
    return Response.json({ data: null, tooFar: null, error: "Map search is not answering" }, { status: 502 });
  }
}
