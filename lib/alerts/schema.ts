import { z } from "zod";

// The alert contract: what reaches the student's screen as a push-style banner.
// Client-safe; no server imports here.

export const ALERT_KINDS = ["new_event", "free_food_nearby", "leftover_food"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const AlertDraftSchema = z.object({
  kind: z.enum(ALERT_KINDS),
  eventId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(240),
});

// `seq` is a feed-wide counter: clients poll for alerts with a larger seq.
export const AlertSchema = AlertDraftSchema.extend({
  seq: z.number().int().positive(),
  id: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});

export type AlertDraft = z.infer<typeof AlertDraftSchema>;
export type Alert = z.infer<typeof AlertSchema>;

export type AlertPage = { alerts: Alert[]; cursor: number };

// Response shape of GET /api/alerts.
export type AlertRouteResponse = { data: AlertPage | null; error: string | null };
