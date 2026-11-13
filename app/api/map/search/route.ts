import type { NextRequest } from "next/server";
import { z } from "zod";

// GET ?q=<place>: the top map search result near campus, from OpenStreetMap search (no key).
// Returns { name, lat, lng }, or data null when nothing matches.

const AROUND_CAMPUS = "-71.20,42.43,-70.98,42.30";

const ResultSchema = z.array(
  z.object({ lat: z.string(), lon: z.string(), name: z.string().optional(), display_name: z.string() }),
);

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (!q) return Response.json({ data: null, error: "Type a place" }, { status: 400 });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "1", viewbox: AROUND_CAMPUS, bounded: "1" }).toString();
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "meta-MIUT hackathon demo", "accept-language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    const parsed = ResultSchema.safeParse(await response.json());
    const top = parsed.success ? parsed.data[0] : undefined;
    if (!top) return Response.json({ data: null, error: null });
    const name = top.name || top.display_name.split(",")[0] || q;
    return Response.json({ data: { name, lat: Number(top.lat), lng: Number(top.lon) }, error: null });
  } catch {
    return Response.json({ data: null, error: "Map search is not answering" }, { status: 502 });
  }
}
