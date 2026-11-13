"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { CloseIcon } from "@/components/ui/icons";

// Not for me (d-8vow): the X hides an event on this device and teaches Muse
// (POST /api/muse/learn, kind "dismissed"). Same key as the map, so an event
// hidden in one place stays hidden in the other.
const DISMISSED_KEY = "map:dismissed";
const CHANGED = "events:dismissed";
// Storage can be blocked; dismissals then last for this visit only.
let unsaved = "[]";

function snapshot(): string {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) ?? "[]";
  } catch {
    return unsaved;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function parseIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function useDismissed() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const dismissed = useMemo(() => new Set(parseIds(raw)), [raw]);
  const dismiss = useCallback((eventId: string) => {
    const next = JSON.stringify([...new Set([...parseIds(snapshot()), eventId])]);
    unsaved = next;
    try {
      window.localStorage.setItem(DISMISSED_KEY, next);
    } catch {
      // Kept in `unsaved` for this visit.
    }
    window.dispatchEvent(new Event(CHANGED));
    void fetch("/api/muse/learn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, kind: "dismissed" }),
    }).catch(() => undefined);
  }, []);
  return { dismissed, dismiss };
}

export function DismissButton({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Not for me: hide ${title}`}
      className="absolute right-[6px] top-[6px] z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-card text-muted hover:bg-wash"
    >
      <CloseIcon className="h-[13px] w-[13px]" />
    </button>
  );
}
