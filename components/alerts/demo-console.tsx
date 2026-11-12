"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALERT_KINDS, type AlertKind } from "@/lib/alerts/schema";

type EventOption = { id: string; title: string };

const KIND_LABELS: Record<AlertKind, string> = {
  new_event: "New event",
  free_food_nearby: "Free food nearby",
  leftover_food: "Leftover food",
};

const MINUTE = 60_000;

// A canned event that exercises the whole spine without the organizer screens.
function samplePublishBody(now: Date) {
  const start = new Date(now.getTime() + 20 * MINUTE);
  const end = new Date(start.getTime() + 90 * MINUTE);
  return {
    title: "Fall Boulder Social",
    description: "All levels welcome, no experience needed. Gear provided.",
    start: start.toISOString(),
    end: end.toISOString(),
    place: { name: "Zesiger Center climbing wall", lat: 42.3586, lng: -71.096 },
    free: true,
    food: true,
    foodNote: "pizza",
    access: { kind: "rsvp", capacity: 40 },
    organizer: { name: "Sample Climbing Club", handle: "sample_climbing" },
    source: { kind: "manual" },
  };
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { data: unknown; error: string | null };
  return { ok: response.ok, error: json.error };
}

export function DemoConsole({ events, backend }: { events: EventOption[]; backend: string }) {
  const router = useRouter();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [kind, setKind] = useState<AlertKind>("free_food_nearby");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, action: () => Promise<{ ok: boolean; error: string | null }>) {
    setBusy(true);
    setStatus(`${label}...`);
    try {
      const result = await action();
      setStatus(result.ok ? `${label}: done` : `${label}: ${result.error ?? "failed"}`);
      if (result.ok) router.refresh();
    } catch {
      setStatus(`${label}: network error`);
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "w-full rounded-md bg-primary py-2 text-[15px] font-semibold text-white disabled:opacity-60";
  const fieldClass = "w-full rounded-md border border-divider bg-card p-2 text-[15px]";

  return (
    <div className="flex flex-col gap-3 p-3">
      <section className="rounded-lg bg-card p-4">
        <h2 className="text-[17px] font-bold">Demo console</h2>
        <p className="mt-1 text-[13px] text-muted">
          Store backend: <span className="font-semibold">{backend}</span>. Alerts appear as a banner on every open
          screen within a few seconds.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-card p-4">
        <h3 className="text-[15px] font-semibold">Publish a sample event</h3>
        <p className="text-[13px] text-muted">Free pizza, starts in 20 minutes. Sends the publish alert.</p>
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => run("Publish", () => postJson("/api/events", samplePublishBody(new Date())))}
        >
          Publish sample event
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-card p-4">
        <h3 className="text-[15px] font-semibold">Send an alert</h3>
        <label className="text-[13px] text-muted" htmlFor="demo-event">
          Event
        </label>
        <select id="demo-event" className={fieldClass} value={eventId} onChange={(change) => setEventId(change.target.value)}>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        <label className="text-[13px] text-muted" htmlFor="demo-kind">
          Kind
        </label>
        <select
          id="demo-kind"
          className={fieldClass}
          value={kind}
          onChange={(change) => setKind(change.target.value as AlertKind)}
        >
          {ALERT_KINDS.map((option) => (
            <option key={option} value={option}>
              {KIND_LABELS[option]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || eventId === ""}
          className={buttonClass}
          onClick={() => run("Send alert", () => postJson("/api/alerts", { eventId, kind }))}
        >
          Send alert
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-card p-4">
        <h3 className="text-[15px] font-semibold">Reset the demo</h3>
        <p className="text-[13px] text-muted">
          Fresh seed events with times relative to now; clears stored alerts. On the deployed site it needs the demo
          token.
        </p>
        <input
          type="password"
          autoComplete="off"
          placeholder="Demo token (deployed site only)"
          className={fieldClass}
          value={token}
          onChange={(change) => setToken(change.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() =>
            run("Reset", () => postJson("/api/demo/reset", {}, token.trim() ? { "x-demo-token": token.trim() } : {}))
          }
        >
          Reset demo data
        </button>
      </section>

      {status && (
        <p role="status" className="px-1 text-[14px] text-muted">
          {status}
        </p>
      )}
    </div>
  );
}
