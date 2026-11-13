"use client";

import { useEffect, useState } from "react";
import type { ExtractDraft } from "@/components/organizer/types";
import { MuseMark } from "@/components/ui/icons";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";

// "Muse is making your Facebook event" (demo beat O3). Honest by construction:
// the scan runs only while the real extract call is in flight, the checklist
// shows what Muse was asked to read, each line fills in only with what Muse
// actually returned, the clock is the real time the call took, and a recorded
// example says so.

export type MakingState =
  | { phase: "reading"; startedAt: number }
  | { phase: "done"; tookMs: number; live: boolean; draft: ExtractDraft | null; fallbackReason: string | null };

function campusTimes(draft: ExtractDraft): string {
  const day = new Date(draft.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: CAMPUS_TIME_ZONE });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
  return `${day}, ${time(draft.start)} to ${time(draft.end)}`;
}

const READS: { label: string; found: (draft: ExtractDraft) => string }[] = [
  { label: "What it is", found: (draft) => draft.title },
  { label: "When", found: campusTimes },
  { label: "Where", found: (draft) => draft.placeName },
  { label: "Free food", found: (draft) => (draft.food ? (draft.foodNote ?? "Yes") : "None mentioned") },
  { label: "Who can come", found: (draft) => (draft.access.kind === "rsvp" ? "RSVP required" : "Open to everyone") },
];

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <>{((now - startedAt) / 1000).toFixed(1)} s</>;
}

export function MuseMaking({ flyerSrc, state }: { flyerSrc: string | null; state: MakingState }) {
  const reading = state.phase === "reading";
  const draft = state.phase === "done" ? state.draft : null;
  return (
    <section aria-live="polite" aria-busy={reading} className="overflow-hidden rounded-card border border-hairline bg-card">
      <style>{"@keyframes muse-scan{0%{top:-12%}100%{top:100%}}@keyframes muse-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}"}</style>
      <div className="flex items-center gap-[10px] px-3 pt-3">
        <span
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          style={reading ? { animation: "muse-breathe 1.4s ease-in-out infinite" } : undefined}
        >
          <MuseMark className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title font-bold leading-[20px]">
            {reading ? "Muse is making your Facebook event" : state.live ? "Muse made your event" : "Recorded example"}
          </h2>
          <p className="text-meta font-semibold text-muted">
            {reading ? (
              <>
                Reading your post, live · <Elapsed startedAt={state.startedAt} />
              </>
            ) : state.live ? (
              `Read live by Muse in ${(state.tookMs / 1000).toFixed(1)} s. Check it, then post.`
            ) : (
              `Muse was not reachable, so this is a recorded example${state.fallbackReason ? ` (${state.fallbackReason})` : ""}.`
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3 p-3">
        {flyerSrc && (
          <div className="relative h-[150px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border border-hairline bg-wash">
            {/* The organizer's own post image (a drawn flyer in the demo). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flyerSrc} alt="Your post's flyer" className="h-full w-full object-cover" />
            {reading && (
              <span
                aria-hidden
                className="absolute inset-x-0 h-[14%] bg-gradient-to-b from-transparent via-[#0866ff66] to-transparent motion-reduce:hidden"
                style={{ animation: "muse-scan 1.6s ease-in-out infinite" }}
              />
            )}
          </div>
        )}
        <ul className="flex min-w-0 flex-1 flex-col gap-[7px]">
          {READS.map((read, index) => {
            const value = draft ? read.found(draft) : null;
            return (
              <li key={read.label} className="flex items-start gap-[7px]">
                <span
                  aria-hidden
                  className={`mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ${value ? "bg-primary text-white" : "border-2 border-divider"}`}
                  style={reading ? { animation: `muse-breathe 1.2s ease-in-out ${index * 0.2}s infinite` } : undefined}
                >
                  {value && (
                    <svg viewBox="0 0 24 24" className="h-[10px] w-[10px]" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 text-meta leading-[15px]">
                  <span className="font-semibold text-muted">{read.label}</span>
                  <span className="block truncate font-semibold text-ink">{value ?? (reading ? "Reading..." : "Not found")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
