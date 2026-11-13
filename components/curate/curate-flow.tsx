"use client";

import Link from "next/link";
import { useState } from "react";
import { SourceBadge } from "@/components/ui/card";
import { MuseMark } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { USER3_CONNECTORS } from "@/lib/curate/connectors";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";

// "Curate your event feed": the first time someone with a Facebook account
// opens Events. They see what Muse will read, tap once, watch it read each
// source (the call to Muse runs underneath), then get their top events with
// the reason each was picked.

type Pick = { event: CampusEvent; reason: string };
type Curated = { summary: string; picks: Pick[] };
type CurateResponse = { data: (Curated & { storyPinned: boolean }) | null; error: string | null; source?: "muse" | "fixture" };

type Phase = { kind: "intro" } | { kind: "reading"; step: number } | { kind: "done"; feed: Curated; live: boolean } | { kind: "error"; message: string };

const STEP_MS = 950;

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function CurateFlow() {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });

  async function curate() {
    setPhase({ kind: "reading", step: 0 });
    const request = fetch("/api/curate", { method: "POST" })
      .then((response) => response.json() as Promise<CurateResponse>)
      .catch((): CurateResponse => ({ data: null, error: "No connection. Try again." }));
    // One source at a time, at a pace people can read, while Muse works.
    for (let step = 1; step <= USER3_CONNECTORS.length; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      setPhase({ kind: "reading", step });
    }
    const answer = await request;
    if (!answer.data) {
      setPhase({ kind: "error", message: answer.error ?? "Muse could not curate the feed. Try again." });
      return;
    }
    setPhase({ kind: "done", feed: answer.data, live: answer.source === "muse" });
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-[14px] px-[12px] pt-[12px] pb-[20px]">
      <section className="flex items-start gap-[10px]">
        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MuseMark className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-[26px] font-bold">Curate your event feed</h1>
          <p className="mt-[4px] text-body text-muted">
            Muse looks at what you already do, then builds an Events feed you would actually use.
          </p>
        </div>
      </section>

      {phase.kind !== "done" && (
        <ol className="flex flex-col rounded-card border border-hairline">
          {USER3_CONNECTORS.map((source, index) => {
            const reading = phase.kind === "reading" && phase.step === index;
            const read = phase.kind === "reading" && phase.step > index;
            return (
              <li key={source.id} className="border-t border-hairline px-[12px] py-[10px] first:border-t-0">
                <div className="flex items-center gap-[10px]">
                  <span
                    aria-hidden
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                      read ? "bg-primary text-on-primary" : reading ? "border-2 border-primary border-t-transparent animate-spin motion-reduce:animate-none" : "bg-button"
                    }`}
                  >
                    {read ? <Check /> : null}
                  </span>
                  <span className="font-display text-label font-bold">{phase.kind === "intro" ? source.label : source.reading}</span>
                </div>
                {(reading || read) && (
                  <ul className="mt-[6px] ml-[32px] flex flex-col gap-[3px]">
                    {source.items.slice(0, 2).map((item) => (
                      <li key={item} className="text-venue text-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {phase.kind === "intro" && (
        <button type="button" onClick={curate} className="h-[44px] rounded-button bg-primary font-display text-label font-bold text-on-primary">
          Curate my feed
        </button>
      )}
      {phase.kind === "reading" && phase.step >= USER3_CONNECTORS.length && (
        <p role="status" className="text-center font-display text-label font-bold text-link">
          Matching events to you
        </p>
      )}
      {phase.kind === "error" && (
        <div className="flex flex-col gap-[8px]">
          <p role="alert" className="text-body text-ink">
            {phase.message}
          </p>
          <button type="button" onClick={curate} className="h-[40px] rounded-button bg-button font-display text-label font-bold">
            Try again
          </button>
        </div>
      )}

      {phase.kind === "done" && (
        <>
          <p className="rounded-card bg-primary-soft px-[12px] py-[10px] text-body text-ink">
            <span className="font-display font-bold text-link">Muse: </span>
            {phase.feed.summary}
          </p>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-title font-bold">Your top events</h2>
            <SourceBadge source={phase.live ? "muse" : "fixture"} />
          </div>
          <ol className="flex flex-col gap-[12px]">
            {phase.feed.picks.map(({ event, reason }, index) => (
              <li key={event.id}>
                <Link href={`/events/${encodeURIComponent(event.id)}`} className="block overflow-hidden rounded-card border border-hairline">
                  <div className="relative">
                    <Poster seed={event.id} title={event.title} kicker={event.organizer.name} imagePath={event.source.imagePath} size={index === 0 ? "large" : "small"} />
                    <span className="absolute top-[8px] left-[8px] flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-card px-[8px] font-display text-[13px] font-bold text-ink shadow-sm">
                      {index + 1}
                    </span>
                  </div>
                  <div className="px-[12px] py-[10px]">
                    <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
                    <p className="mt-[2px] font-display text-title font-bold">{event.title}</p>
                    <p className="text-venue text-muted">{event.place.name}</p>
                    <p className="mt-[6px] flex items-start gap-[6px] text-venue text-link">
                      <MuseMark className="mt-[1px] h-[14px] w-[14px] shrink-0" />
                      <span>{reason}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
