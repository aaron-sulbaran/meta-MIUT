"use client";

import { useState } from "react";
import type { CampusEvent } from "@/lib/events/schema";
import { TIME_WINDOWS, TIME_WINDOW_LABELS, filterEvents, type TimeWindow } from "@/lib/events/time";
import { EventCard } from "@/components/events/event-card";

export function EventFeed({ events, nowIso }: { events: CampusEvent[]; nowIso: string }) {
  const now = new Date(nowIso);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("today");
  const [freeOnly, setFreeOnly] = useState(true);
  const visible = filterEvents(events, { window: timeWindow, freeOnly, now });

  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={freeOnly}
          onClick={() => setFreeOnly((value) => !value)}
          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[14px] font-semibold ${
            freeOnly ? "bg-free text-white" : "bg-card text-ink"
          }`}
        >
          <span className={`h-3 w-3 rounded-full ${freeOnly ? "bg-white" : "bg-divider"}`} />
          Free
        </button>
        {TIME_WINDOWS.map((window) => (
          <button
            key={window}
            type="button"
            aria-pressed={timeWindow === window}
            onClick={() => setTimeWindow(window)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[14px] font-semibold ${
              timeWindow === window ? "bg-primary-soft text-primary" : "bg-card text-ink"
            }`}
          >
            {TIME_WINDOW_LABELS[window]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-3">
        {visible.length === 0 ? (
          <p className="rounded-lg bg-card p-6 text-center text-[15px] text-muted">
            Nothing {freeOnly ? "free " : ""}in this window. Try This week.
          </p>
        ) : (
          visible.map((event) => <EventCard key={event.id} event={event} now={now} />)
        )}
      </div>
    </div>
  );
}
