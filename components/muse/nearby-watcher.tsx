"use client";

import { usePathname, useRouter } from "next/navigation";
import { isStagedScreen } from "@/lib/demo/staged";
import { useEffect, useSyncExternalStore } from "react";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import type { Alert } from "@/lib/alerts/schema";

// Watches where the student is while the app is open (also in a background
// tab) and asks the server for nearby alerts. New alerts reach the screen
// through the shared feed and AlertListener; when the tab is hidden they also
// show as a system notification. Add ?at=<lat>,<lng> to any URL to simulate a
// location for the demo.

type Location = { lat: number; lng: number };
type Pref = "on" | "dismissed" | "denied";
type NearbyResponse = { data: { alerts: Alert[] } | null; error: string | null };

const PREF_KEY = "nearby-alerts";
const SIMULATED_KEY = "nearby-alerts-at";
const RECHECK_MS = 60_000;
const MOVED_METERS = 100;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readPref(): Pref | null {
  return localStorage.getItem(PREF_KEY) as Pref | null;
}

function writePref(pref: Pref) {
  localStorage.setItem(PREF_KEY, pref);
  listeners.forEach((listener) => listener());
}

function parseLocation(text: string | null): Location | null {
  const [lat, lng] = (text ?? "").split(",").map(Number);
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

// A ?at= in the URL wins and is remembered for this tab.
function simulatedLocation(): Location | null {
  const fromUrl = new URLSearchParams(window.location.search).get("at");
  if (fromUrl && parseLocation(fromUrl)) sessionStorage.setItem(SIMULATED_KEY, fromUrl);
  return parseLocation(sessionStorage.getItem(SIMULATED_KEY));
}

function metersBetween(from: Location, to: Location): number {
  const rad = Math.PI / 180;
  const x = (to.lng - from.lng) * rad * Math.cos(((from.lat + to.lat) / 2) * rad);
  const y = (to.lat - from.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

function notifyInBackground(alerts: Alert[], open: (path: string) => void) {
  if (document.visibilityState === "visible") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  for (const alert of alerts) {
    const notification = new Notification(alert.title, { body: alert.body, tag: alert.id });
    notification.onclick = () => {
      window.focus();
      open(`/events/${encodeURIComponent(alert.eventId)}`);
    };
  }
}

export function NearbyWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const pref = useSyncExternalStore(subscribe, readPref, () => "dismissed" as const);

  useEffect(() => {
    if (pref === null && simulatedLocation()) writePref("on");
  }, [pref]);

  useEffect(() => {
    if (pref !== "on") return;
    let stopped = false;
    let latest: Location | null = null;
    let lastSent: { location: Location; at: number } | null = null;

    async function report(location: Location, force = false) {
      const now = Date.now();
      if (!force && lastSent && metersBetween(lastSent.location, location) < MOVED_METERS && now - lastSent.at < RECHECK_MS) {
        return;
      }
      lastSent = { location, at: now };
      try {
        const response = await fetch("/api/muse/nearby", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ location }),
        });
        const body = (await response.json()) as NearbyResponse;
        if (!stopped && body.data) notifyInBackground(body.data.alerts, router.push);
      } catch {
        // Offline; the next position or recheck tries again.
      }
    }

    let watchId: number | undefined;
    const simulated = simulatedLocation();
    if (simulated) {
      latest = simulated;
      void report(simulated);
    } else if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          latest = { lat: position.coords.latitude, lng: position.coords.longitude };
          void report(latest);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) writePref("denied");
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
      );
    }
    // Events start over time, so check again even when the student stands still.
    const timer = setInterval(() => {
      if (latest) void report(latest, true);
    }, RECHECK_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [pref, router]);

  // Not on staged screens: they imitate another app (Instagram).
  if (pref !== null || isStagedScreen(pathname)) return null;

  function turnOn() {
    writePref("on");
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--tabbar-gap)+12px)] z-40 mx-auto w-full max-w-[390px] px-3">
      <div className="flex items-center gap-[10px] rounded-card border border-hairline bg-card py-[10px] pl-[12px] pr-[4px] shadow-[0_6px_20px_rgb(0_0_0/0.12)]">
        <MapPinIcon className="h-[22px] w-[22px] shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-body text-ink">Get an alert when something you&apos;d like is nearby.</span>
        <button
          type="button"
          onClick={turnOn}
          className="shrink-0 rounded-full bg-primary px-[12px] py-[6px] font-display text-label font-bold text-white"
        >
          Turn on
        </button>
        <button
          type="button"
          onClick={() => writePref("dismissed")}
          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-muted"
          aria-label="Not now"
        >
          <CloseIcon className="h-[15px] w-[15px]" />
        </button>
      </div>
    </div>
  );
}
