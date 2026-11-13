"use client";

import Link from "next/link";
import { handOff } from "@/lib/demo/staged";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/demo/moments/brand-mark";
import { SourceBadge } from "@/components/ui/card";
import { MuseMark } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { USER3_CONNECTORS, type ConnectorSource } from "@/lib/curate/connectors";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";

// "Curate your event feed": the first time someone with a Facebook account
// opens Events. They see what Muse will read, tap once (or the demo starts it,
// ?auto=1), watch it read each source while the real ranking call runs, then
// her top events assemble with the reason each was picked. The sources are
// seeded sample data, and the screen says so once.

type Pick = { event: CampusEvent; reason: string };
type Curated = { summary: string; picks: Pick[] };
type CurateResponse = { data: (Curated & { storyPinned: boolean }) | null; error: string | null; source?: "muse" | "fixture" };

type Phase = { kind: "intro" } | { kind: "reading"; step: number } | { kind: "done"; feed: Curated; live: boolean } | { kind: "error"; message: string };

const STEP_MS = 820;
const AUTO_DELAY_MS = 500;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-[12px] w-[12px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function SourceIcon({ id }: { id: ConnectorSource["id"] }) {
  if (id === "instagram" || id === "reels") return <BrandMark name="instagram" className="h-[20px] w-[20px]" decorative />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[20px] w-[20px] text-ink" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {id === "email" ? (
        <>
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
          <path d="M4 7l8 6 8-6" />
        </>
      ) : (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </>
      )}
    </svg>
  );
}

export function CurateFlow({ auto = false }: { auto?: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const started = useRef(false);

  async function curate() {
    if (started.current && phase.kind !== "error") return;
    started.current = true;
    setPhase({ kind: "reading", step: 0 });
    // One retry before giving up: a dropped request mid-demo should not end on an error.
    const ask = () => fetch("/api/curate", { method: "POST" }).then((response) => response.json() as Promise<CurateResponse>);
    const request = ask()
      .catch(() => new Promise((resolve) => setTimeout(resolve, 800)).then(ask))
      .catch((): CurateResponse => ({ data: null, error: "No connection. Try again." }));
    // One source at a time, at a pace people can read, while Muse works.
    const pace = reducedMotion() ? 0 : STEP_MS;
    for (let step = 1; step <= USER3_CONNECTORS.length; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, pace));
      setPhase({ kind: "reading", step });
    }
    const answer = await request;
    if (!answer.data) {
      setPhase({ kind: "error", message: answer.error ?? "Muse could not curate the feed. Try again." });
      return;
    }
    setPhase({ kind: "done", feed: answer.data, live: answer.source === "muse" });
  }

  // ?auto=1: the demo stage starts it on arrival, so the clicker is the one tap.
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => void curate(), AUTO_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const now = new Date();
  const done = phase.kind === "done";
  const matching = phase.kind === "reading" && phase.step >= USER3_CONNECTORS.length;

  return (
    <div className="flex flex-col gap-[14px] px-[12px] pt-[12px] pb-[20px]">
      <style>{CURATE_CSS}</style>
      <section className="flex items-start gap-[10px]">
        <span className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary ${phase.kind === "reading" ? "curate-breathe" : ""}`}>
          <MuseMark className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-[26px] font-bold">{done ? "Your event feed" : "Curate your event feed"}</h1>
          <p className="mt-[4px] text-body text-muted">
            {done ? "Muse built this from what you already do." : "Muse looks at what you already do, then builds an Events feed you would actually use."}
          </p>
        </div>
      </section>

      <section aria-live="polite" className="overflow-hidden rounded-card border border-hairline">
        <ol className={done ? "flex items-center gap-[8px] px-[12px] py-[9px]" : "flex flex-col"}>
          {USER3_CONNECTORS.map((source, index) => {
            const reading = phase.kind === "reading" && phase.step === index;
            const read = done || (phase.kind === "reading" && phase.step > index);
            if (done) {
              return (
                <li key={source.id} className="curate-fade relative" title={source.label}>
                  <SourceIcon id={source.id} />
                  <span className="absolute -right-[4px] -bottom-[3px] flex h-[13px] w-[13px] items-center justify-center rounded-full bg-primary text-on-primary ring-2 ring-white">
                    <Check />
                  </span>
                </li>
              );
            }
            return (
              <li
                key={source.id}
                className={`border-t border-hairline px-[12px] py-[10px] transition-colors duration-300 first:border-t-0 ${reading ? "bg-primary-soft" : ""}`}
              >
                <div className="flex items-center gap-[10px]">
                  <SourceIcon id={source.id} />
                  <span className="min-w-0 flex-1 font-display text-label font-bold">{phase.kind === "intro" ? source.label : source.reading}</span>
                  <span
                    aria-hidden
                    className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${read ? "bg-primary text-on-primary" : "bg-button"}`}
                  >
                    {read ? <Check /> : null}
                  </span>
                </div>
                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${reading || read ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <ul className="ml-[30px] flex min-h-0 flex-col gap-[3px] overflow-hidden">
                    {source.items.slice(0, 2).map((item, line) => (
                      <li key={item} className={`text-venue text-muted ${reading ? "curate-line" : ""} first:mt-[6px]`} style={{ animationDelay: `${line * 260}ms` }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
          {done && <li className="curate-fade ml-[4px] text-venue font-semibold text-muted">Read {USER3_CONNECTORS.length} sources · sample data</li>}
        </ol>
        {matching && (
          <div className="flex items-center gap-[10px] border-t border-hairline px-[12px] py-[10px]">
            <span aria-hidden className="relative h-[4px] flex-1 overflow-hidden rounded-full bg-primary-soft">
              <span className="curate-sweep absolute inset-y-0 w-1/3 rounded-full bg-primary" />
            </span>
            <span role="status" className="font-display text-label font-bold text-link">
              Matching events to you
            </span>
          </div>
        )}
      </section>
      {!done && phase.kind !== "intro" && <p className="-mt-[8px] text-meta text-muted">Sample data for the demo, not a real account.</p>}

      {phase.kind === "intro" && (
        <button type="button" onClick={curate} className="h-[44px] rounded-button bg-primary font-display text-label font-bold text-on-primary">
          Curate my feed
        </button>
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
          <p className="curate-rise rounded-card bg-primary-soft px-[12px] py-[10px] text-body text-ink">
            <span className="font-display font-bold text-link">Muse: </span>
            {phase.feed.summary}
          </p>
          <div className="curate-rise flex items-baseline justify-between" style={{ animationDelay: "80ms" }}>
            <h2 className="font-display text-title font-bold">Your top events</h2>
            <SourceBadge source={phase.live ? "muse" : "fixture"} />
          </div>
          <ol className="flex flex-col gap-[12px]">
            {phase.feed.picks.map(({ event, reason }, index) => (
              <li key={event.id} className="curate-rise" style={{ animationDelay: `${180 + index * 170}ms` }}>
                <Link
                  href={`/events/${encodeURIComponent(event.id)}`}
                  // In the /demo stage or a presenter's phone, opening a pick is the tap that moves the show on (U3d).
                  onClick={() => handOff(`/events/${encodeURIComponent(event.id)}`, () => {})}
                  className="block overflow-hidden rounded-card border border-hairline"
                >
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

const CURATE_CSS = `
@keyframes curate-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes curate-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes curate-sweep { 0% { left: -33%; } 100% { left: 100%; } }
@keyframes curate-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
.curate-rise { animation: curate-rise 420ms cubic-bezier(.3,.7,.3,1) both; }
.curate-fade { animation: curate-fade 300ms ease both; }
.curate-line { animation: curate-fade 360ms ease both; }
.curate-sweep { animation: curate-sweep 1.1s cubic-bezier(.45,0,.55,1) infinite; }
.curate-breathe { animation: curate-breathe 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .curate-rise, .curate-fade, .curate-line, .curate-sweep, .curate-breathe { animation: none; }
}
`;
