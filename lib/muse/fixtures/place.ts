import type { PlaceRead } from "@/lib/muse/place";

// Recorded stand-in for the place read: without Muse, search for what the student typed.
export function placeFixture(text: string): PlaceRead {
  return { reachable: true, query: text.trim().slice(0, 80), reason: "" };
}
