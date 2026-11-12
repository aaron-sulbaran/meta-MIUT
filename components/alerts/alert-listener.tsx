"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBanner } from "@/components/alerts/alert-banner";
import type { Alert, AlertRouteResponse } from "@/lib/alerts/schema";

const POLL_INTERVAL_MS = 2_500;
const BANNER_VISIBLE_MS = 8_000;

// Mount once, high in the tree (the root layout), so it survives navigation.
// Polls GET /api/alerts; the first call only learns the current cursor, so a
// freshly opened screen never replays old alerts. A new alert shows a banner
// and refreshes server components so the new event is already in the feed
// when the student taps through.
export function AlertListener({ pollIntervalMs = POLL_INTERVAL_MS }: { pollIntervalMs?: number }) {
  const router = useRouter();
  const cursorRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<Alert[]>([]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (document.visibilityState === "visible") {
        const cursor = cursorRef.current;
        try {
          const response = await fetch(cursor === null ? "/api/alerts" : `/api/alerts?since=${cursor}`, {
            cache: "no-store",
          });
          const body = (await response.json()) as AlertRouteResponse;
          const page = body.data;
          if (!stopped && page) {
            cursorRef.current = page.cursor;
            if (cursor !== null && page.alerts.length > 0) {
              setQueue((current) => [...current, ...page.alerts]);
              router.refresh();
            }
          }
        } catch {
          // Offline or a cold start; try again on the next tick.
        }
      }
      if (!stopped) timer = setTimeout(poll, pollIntervalMs);
    }

    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollIntervalMs, router]);

  const current = queue[0] ?? null;

  const dismiss = useCallback((alert: Alert) => {
    setQueue((items) => items.filter((item) => item.id !== alert.id));
  }, []);

  const open = useCallback(
    (alert: Alert) => {
      dismiss(alert);
      router.push(`/events/${encodeURIComponent(alert.eventId)}`);
    },
    [dismiss, router],
  );

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismiss(current), BANNER_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-2 z-50 mx-auto w-full max-w-[390px] px-2"
    >
      {current && <AlertBanner key={current.id} alert={current} onOpen={open} onDismiss={dismiss} />}
    </div>
  );
}
