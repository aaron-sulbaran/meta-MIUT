"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/alerts/schema";

// A push-notification style banner pinned to the top of the phone frame.
export function AlertBanner({
  alert,
  onOpen,
  onDismiss,
}: {
  alert: Alert;
  onOpen: (alert: Alert) => void;
  onDismiss: (alert: Alert) => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl bg-card/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(alert)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        aria-label={`${alert.title}. ${alert.body}. Open the event.`}
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[20px] font-bold text-white"
        >
          f
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2 text-[12px] text-muted">
            <span className="font-semibold uppercase tracking-wide">Facebook</span>
            <span>now</span>
          </span>
          <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-ink">{alert.title}</span>
          <span className="block text-[14px] leading-snug text-ink">{alert.body}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDismiss(alert)}
        className="-mr-1 -mt-1 rounded-full px-2 py-1 text-[18px] leading-none text-muted"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
