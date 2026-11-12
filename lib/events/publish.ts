import "server-only";
import { z } from "zod";
import { composeAlert } from "@/lib/alerts/compose";
import { getAlertFeed, type AlertFeed } from "@/lib/alerts/feed";
import { alertKindForPublishedEvent } from "@/lib/alerts/policy";
import type { Alert } from "@/lib/alerts/schema";
import {
  AccessSchema,
  ConfidenceSchema,
  OrganizerSchema,
  PlaceSchema,
  SourceSchema,
  type CampusEvent,
} from "@/lib/events/schema";
import { getEventStore, type EventStore, type StoreResult } from "@/lib/events/store";

// What the organizer flow sends when the organizer taps Publish: the confirmed
// draft plus a resolved place. The server fills id, status, and createdAt.
export const PublishEventInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(4000),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  place: PlaceSchema,
  free: z.boolean(),
  food: z.boolean(),
  foodNote: z.string().max(200).optional(),
  access: AccessSchema,
  organizer: OrganizerSchema,
  source: SourceSchema,
  confidence: ConfidenceSchema.optional(),
});

export type PublishEventInput = z.infer<typeof PublishEventInputSchema>;

export type PublishOutcome = {
  event: CampusEvent;
  // Null when the policy sends no alert, or when sending it failed (see alertError).
  alert: Alert | null;
  alertError: string | null;
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "event"
  );
}

function newEventId(title: string, now: Date): string {
  const suffix = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `evt-${slugify(title)}-${suffix}`;
}

// Publishing is the one write the demo spine needs: store the event, then tell
// the student. The event is saved even if the alert fails.
export async function publishEvent(
  input: PublishEventInput,
  options: { now?: Date; store?: EventStore; feed?: AlertFeed } = {},
): Promise<StoreResult<PublishOutcome>> {
  const now = options.now ?? new Date();
  const store = options.store ?? getEventStore();
  const feed = options.feed ?? getAlertFeed();

  const saved = await store.upsertEvent({
    ...input,
    id: newEventId(input.title, now),
    status: "published",
    createdAt: now.toISOString(),
  });
  if (saved.error !== null) return { data: null, error: saved.error };

  const kind = alertKindForPublishedEvent(saved.data);
  if (kind === null) return { data: { event: saved.data, alert: null, alertError: null }, error: null };

  const sent = await feed.publish(composeAlert(saved.data, kind, now));
  return {
    data: { event: saved.data, alert: sent.data, alertError: sent.error },
    error: null,
  };
}
