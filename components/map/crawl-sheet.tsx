"use client";

import type { CSSProperties, ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { arrivesTooLate, type Route, type RouteStop } from "@/lib/map/crawl-route";

// The Food Crawl sheet's own pieces (Trish's planner, crawl-planner.tsx), shared
// with the Muse card (muse-conversation.tsx) so the two read as one sheet: the
// same frame, handle, close, stop rows, end row and bottom row of actions.

export const SHEET_CLASS = "absolute inset-x-0 bottom-0 z-20 rounded-t-[18px] bg-card shadow-[0_-6px_20px_rgba(0,0,0,0.12)]";

/** Bottom padding that clears the floating tab bar, used by the sheet's last row. */
export const CLEAR_TABBAR = "pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+14px)]";

export function SheetHandle({ className = "" }: { className?: string }) {
  return <div className={`mx-auto mb-2 h-1 w-8 rounded-full bg-divider ${className}`} />;
}

export function SheetClose({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`flex h-8 w-8 items-center justify-center rounded-full text-muted ${className}`}>
      <CloseIcon className="h-[14px] w-[14px]" />
    </button>
  );
}

// Small line glyphs for the sheet (no emoji in UI strings).
export function Glyph({ path, className = "h-[17px] w-[17px]" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={path} />
    </svg>
  );
}
export const HOME_PATH = "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10";
export const PERSON_PATH = "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0";
export const PIN_PATH = "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";
export const LOOP_PATH = "M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5";

export const KIND_LABELS: Record<string, string> = {
  main: "Main",
  dessert: "Dessert",
  drinks: "Drinks",
  snack: "Snack",
  merch: "Merch",
  event: "Event",
  plan: "Your stop",
  added: "Added",
};

// Times in campus time, like every other time in the app.
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

/** "2 stops · 9 min on the move · Maseeh Hall by 3:21 PM": the facts line under the Muse card's heading (the planner writes its own). */
export function routeSummary(route: Route, endName = route.destination.name): string {
  const stops = route.stops.length === 0 ? "" : `${route.stops.length} ${route.stops.length === 1 ? "stop" : "stops"} · `;
  return `${stops}${route.totalWalkMinutes} min on the move · ${endName} by ${clock(route.destination.arriveAt)}`;
}

/** The numbered dot a stop wears on the sheet and on the map. */
export function StopNumber({ n }: { n: number }) {
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e6b33] text-[11px] font-bold text-white">{n}</span>;
}

export function StartRow({ leave }: { leave: string }) {
  return (
    <li className="flex items-center gap-3 py-[7px]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-3 w-3 rounded-full border-2 border-white bg-primary shadow-[0_0_0_4px_rgba(8,102,255,0.18)]" />
      </span>
      <span className="text-meta font-semibold">Your location · leave {leave}</span>
    </li>
  );
}

export function StopRow({
  stop,
  index,
  until,
  onRemove,
  className = "",
  style,
}: {
  stop: RouteStop;
  index: number;
  /** When the event ends (ISO), if known. */
  until?: string | null;
  onRemove?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const late = arrivesTooLate(stop);
  return (
    <li className={`flex items-center gap-3 border-t border-hairline py-[8px] ${className}`} style={style}>
      <StopNumber n={index + 1} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label font-semibold">
          <span className="mr-1 text-meta font-semibold text-[#1e6b33]">{KIND_LABELS[stop.kind] ?? "Stop"}</span>
          {stop.title}
        </p>
        <p className="truncate text-meta text-muted">
          {stop.walkMinutes} min {stop.mode === "walk" ? "walk" : stop.mode} · arrive {clock(stop.arriveAt)}
          {until ? ` · until ${clock(until)}` : ""} · {stop.placeName}
        </p>
        {late && <p className="text-meta font-semibold text-badge">Ends before you get there</p>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${stop.title}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wash"
        >
          <CloseIcon className="h-[12px] w-[12px]" />
        </button>
      )}
    </li>
  );
}

export function EndRow({ glyph, name, walkMinutes, arriveAt, children }: { glyph: string; name: string; walkMinutes: number; arriveAt: string; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-hairline py-[8px]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden>
        <Glyph path={glyph} className="h-[13px] w-[13px]" />
      </span>
      <span className="min-w-0 flex-1 truncate text-label font-semibold">{name}</span>
      <span className="shrink-0 text-meta text-muted">
        {walkMinutes} min · {clock(arriveAt)}
      </span>
      {children}
    </li>
  );
}

export type InviteState = "idle" | "sending" | "sent" | "error";

/**
 * The sheet's bottom row: Get directions, then the friend's invite ("Send to Lisa",
 * "Invite sent to Lisa") when the walk has one, else "Send to a friend".
 */
export function CrawlActions({
  directionsUrl,
  friendName,
  invited,
  onInvite,
  onSent,
  onShare,
  shared,
}: {
  /** Google Maps directions; null while there is no walk yet (the row stays, dimmed). */
  directionsUrl: string | null;
  /** The friend the walk ends with, when Muse can invite them in the app. */
  friendName: string | null;
  invited: InviteState;
  onInvite: () => void;
  /** Tapping the sent invite (the demo stage passes the show to the friend); disabled when left out. */
  onSent?: () => void;
  onShare: () => void;
  shared: boolean;
}) {
  return (
    <div className={`flex shrink-0 gap-2 border-t border-hairline px-4 pt-3 ${CLEAR_TABBAR}`}>
      {directionsUrl ? (
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-[10px] bg-primary py-[9px] text-center text-label font-semibold text-on-primary">
          Get directions
        </a>
      ) : (
        <span aria-disabled className="flex-1 rounded-[10px] bg-primary py-[9px] text-center text-label font-semibold text-on-primary opacity-40">
          Get directions
        </span>
      )}
      {friendName ? (
        <button
          type="button"
          aria-live="polite"
          disabled={invited === "sending" || (invited === "sent" && !onSent)}
          onClick={invited === "sent" ? onSent : onInvite}
          className={`flex-1 rounded-[10px] py-[9px] text-label font-semibold ${invited === "sent" ? "bg-primary-soft text-link" : "bg-wash"}`}
        >
          {invited === "sent"
            ? `Invite sent to ${friendName}`
            : invited === "sending"
              ? "Sending..."
              : invited === "error"
                ? "Try sending again"
                : `Send to ${friendName}`}
        </button>
      ) : (
        <button type="button" onClick={onShare} disabled={!directionsUrl} className="flex-1 rounded-[10px] bg-wash py-[9px] text-label font-semibold disabled:opacity-40">
          {shared ? "Invite ready" : "Send to a friend"}
        </button>
      )}
    </div>
  );
}
