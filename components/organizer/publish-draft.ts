import type { ExtractDraft, OrganizerOption } from "@/components/organizer/types";
import type { Alert } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";
import { campusCenter, resolvePlace, type KnownPlace } from "@/lib/organizer/place";

// Publish a Muse draft exactly as Muse read it (the demo's one tap "Post"),
// through the same POST /api/events the draft form uses. The place resolves
// to a known spot by name, else the campus pin.

export type Published = { event: CampusEvent; alert: Alert | null };

export async function publishDraft(
  draft: ExtractDraft,
  { places, organizer, caption }: { places: KnownPlace[]; organizer: OrganizerOption; caption: string },
): Promise<{ data: Published; error: null } | { data: null; error: string }> {
  const known = resolvePlace(draft.placeName, places);
  const spot = known ? { lat: known.place.lat, lng: known.place.lng } : campusCenter(places);
  if (!spot) return { data: null, error: "Could not place this event on the map." };
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: draft.title.trim(),
      description: draft.description.trim(),
      start: draft.start,
      end: draft.end,
      place: { name: draft.placeName.trim(), ...spot },
      free: draft.free,
      food: draft.food,
      ...(draft.food && draft.foodNote?.trim() ? { foodNote: draft.foodNote.trim() } : {}),
      access: draft.access,
      organizer: { name: organizer.name, handle: organizer.handle },
      source: { kind: "instagram", caption: caption.trim() || undefined },
      confidence: draft.confidence,
    }),
  }).catch(() => null);
  if (!response) return { data: null, error: "No connection. Try again." };
  try {
    const body = (await response.json()) as { data: Published | null; error: string | null };
    if (body.error !== null || !body.data) return { data: null, error: body.error ?? "Could not post. Try again." };
    return { data: body.data, error: null };
  } catch {
    return { data: null, error: `The server answered HTTP ${response.status}` };
  }
}
