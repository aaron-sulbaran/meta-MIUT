"use client";

import { useEffect, useState } from "react";
import { BellIcon, CloseIcon } from "@/components/ui/icons";
import type { Alert } from "@/lib/alerts/schema";

// An in-app notification banner pinned to the top of the phone frame, drawn
// like a Facebook notification row: blue bell disc, bold title, body, "Just now".
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
      className={`pointer-events-auto flex items-start gap-[10px] rounded-card border border-hairline bg-card py-[10px] pl-[10px] pr-[4px] shadow-[0_6px_20px_rgb(0_0_0/0.16)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(alert)}
        className="flex min-w-0 flex-1 items-start gap-[10px] text-left"
        aria-label={`${alert.title}. ${alert.body}. Open the event.`}
      >
        <span aria-hidden className="relative mt-[1px] flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <BellIcon className="h-[21px] w-[21px]" />
          <span className="absolute -bottom-[2px] -right-[2px] h-[12px] w-[12px] rounded-full border-2 border-card bg-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-label font-bold text-ink">{alert.title}</span>
          <span className="mt-[1px] block text-body text-ink">{alert.body}</span>
          <span className="mt-[2px] block text-meta font-semibold text-link">Just now</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDismiss(alert)}
        className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-muted"
        aria-label="Dismiss notification"
      >
        <CloseIcon className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
