"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SourceMark } from "@/components/curate/source-mark";
import { useStageBeat } from "@/components/demo/phone-beat-sync";
import { MetaAiMark } from "@/components/ui/meta-ai-mark";
import { APP_SWITCH_MS } from "@/components/demo/app-switch";
import { USER3_CONNECTORS } from "@/lib/curate/connectors";
import { HANDOFF, handOff } from "@/lib/demo/staged";

// Someone's first visit to Facebook Events (?first=1, Trish in the demo). The real
// map shows first, untouched. About a second later Muse asks, in a sheet, whether it
// may build her Events feed, listing every source it would look at. Nothing is read
// before she taps yes. On yes the real curate call starts (/api/curate) and Muse reads
// each source on screen, one row at a time, each with its official mark and one line of
// what it found in the seeded sample accounts. The reading lasts as long as the call
// plus about a second, never under about four seconds; then the screen opens the List,
// where the Top 3 are her own picks (components/events/top-picks.tsx).
//
// In the /demo stage each step is a beat (U3b map, U3b2 ask, U3b3 read, U3c list). A step
// this screen takes by itself (the sheet appearing, yes, the reading done) is told to its
// wrapper with a "demo-handoff" for that beat's path; the stage moves this screen in place
// with {type: "demo-first", step}. `reported` is the furthest step the wrapper knows, so
// a step the stage already moved to is never reported twice.

type Step = "map" | "ask" | "read" | "dismissed";
type Answer = { at: number; ok: boolean };

const STEP_INDEX = { map: 0, ask: 1, read: 2, list: 3 } as const;
const STEP_PATH = [HANDOFF.firstEvents, HANDOFF.firstEventsAsk, HANDOFF.firstEventsRead, HANDOFF.firstEventsList];
const BEAT_STEP: Record<string, number> = { U3b: 0, U3b2: 1, U3b3: 2, U3c: 3 };

// The sheet comes about a second after the map's pins and base map are in view, never later than MAP_WAIT_MS.
const ASK_DELAY_MS = 1_000;
const MAP_WAIT_MS = 6_000;
// Each source row shows at least this long; the last waits for the answer plus ANSWER_PAD_MS.
const ROW_MS = 650;
const ANSWER_PAD_MS = 1_000;
// "Done" holds this long before the List opens.
const DONE_HOLD_MS = 700;
// A backstop past the server's own 8 s budget: the List opens with the recorded picks.
const CALL_TIMEOUT_MS = 11_000;

const SHEET_CSS = `
@keyframes fv-scrim { from { opacity: 0 } to { opacity: 1 } }
@keyframes fv-up { from { transform: translateY(100%) } to { transform: none } }
@keyframes fv-rise { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@keyframes fv-spin { to { transform: rotate(360deg) } }
.fv-scrim { animation: fv-scrim 260ms ease-out both; }
.fv-up { animation: fv-up 340ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.fv-rise { animation: fv-rise 260ms ease-out both; }
.fv-spin { animation: fv-spin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .fv-scrim, .fv-up, .fv-rise, .fv-spin { animation: none; } }
`;

function inFrame(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-[12px] w-[12px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function RowStatus({ state }: { state: "waiting" | "reading" | "done" }) {
  if (state === "done") {
    return (
      <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
        <Check />
      </span>
    );
  }
  if (state === "reading") {
    return <span aria-hidden className="fv-spin h-[18px] w-[18px] shrink-0 rounded-full border-2 border-primary-soft border-t-primary" />;
  }
  return <span aria-hidden className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-hairline" />;
}

export function FirstVisit({ startStep = null, openedFromApp = false }: { startStep?: "ask" | "read" | null; openedFromApp?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startStep ?? "map");
  const [ticked, setTicked] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const readStartRef = useRef<number | null>(null);
  const reportedRef = useRef<number>(startStep === "read" ? 2 : startStep === "ask" ? 1 : 0);
  const listGoneRef = useRef(false);
  const startedCallRef = useRef(false);

  // Tell the wrapper (the stage or a presenter's phone) this screen took a step itself.
  const report = useCallback((index: number) => {
    if (!inFrame() || index <= reportedRef.current) return;
    reportedRef.current = index;
    window.parent.postMessage({ type: "demo-handoff", path: STEP_PATH[index] }, window.location.origin);
  }, []);

  const openList = useCallback(
    (tell: boolean) => {
      if (listGoneRef.current) return;
      listGoneRef.current = true;
      const path = HANDOFF.firstEventsList;
      if (tell && reportedRef.current < STEP_INDEX.list) {
        reportedRef.current = STEP_INDEX.list;
        handOff(path, router.push);
      } else {
        router.push(path);
      }
    },
    [router],
  );

  // The real curate call: starts on yes, never before.
  const startCall = useCallback(() => {
    if (startedCallRef.current) return;
    startedCallRef.current = true;
    readStartRef.current = Date.now();
    router.prefetch(HANDOFF.firstEventsList);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    fetch("/api/curate", { method: "POST", signal: controller.signal })
      .then((response) => setAnswer({ at: Date.now(), ok: response.ok }))
      .catch(() => setAnswer({ at: Date.now(), ok: false }))
      .finally(() => window.clearTimeout(timeout));
  }, [router]);

  const startReading = useCallback(() => {
    setStep("read");
    startCall();
  }, [startCall]);

  const sayYes = useCallback(() => {
    report(STEP_INDEX.read);
    startReading();
  }, [report, startReading]);

  // Arrived on the reading step (a jump straight to U3b3): read at once.
  useEffect(() => {
    if (startStep === "read") startCall();
  }, [startStep, startCall]);

  // The sheet comes by itself about a second after the map is in view: once its pins are on
  // the map (MapLibre markers), or at the latest MAP_WAIT_MS after arriving.
  useEffect(() => {
    if (step !== "map" || startStep !== null) return;
    const arrived = Date.now() + (openedFromApp ? APP_SWITCH_MS : 0);
    let timer: number | undefined;
    const ask = () => {
      setStep((current) => (current === "map" ? "ask" : current));
      report(STEP_INDEX.ask);
    };
    const poll = window.setInterval(() => {
      // Event pins (anchored bottom; the blue dot is centered) and the base map drawn (events-map.tsx).
      const pinsUp = document.querySelector(".maplibregl-marker-anchor-bottom") !== null && document.querySelector("[data-map-loaded]") !== null;
      if (!pinsUp && Date.now() < arrived + MAP_WAIT_MS) return;
      window.clearInterval(poll);
      timer = window.setTimeout(ask, Math.max(ASK_DELAY_MS, arrived + ASK_DELAY_MS - Date.now()));
    }, 150);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer);
    };
  }, [step, startStep, openedFromApp, report]);

  // Rows tick one after another; the last one only once Muse has answered (plus a beat).
  useEffect(() => {
    if (step !== "read" || readStartRef.current === null) return;
    const total = USER3_CONNECTORS.length;
    if (ticked >= total) return;
    const startedAt = readStartRef.current;
    const isLast = ticked === total - 1;
    if (isLast && !answer) return;
    const due = isLast ? Math.max(startedAt + total * ROW_MS, answer!.at + ANSWER_PAD_MS) : startedAt + (ticked + 1) * ROW_MS;
    const timer = window.setTimeout(() => setTicked((count) => Math.max(count, ticked + 1)), Math.max(0, due - Date.now()));
    return () => window.clearTimeout(timer);
  }, [step, ticked, answer]);

  // Done: a short hold on "Done", then the List.
  const done = ticked >= USER3_CONNECTORS.length;
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => openList(true), DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [done, openList]);

  // The stage moves this screen in place; it also says which beat it is on.
  const pendingListRef = useRef(false);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { type?: unknown; step?: unknown } | null;
      if (data?.type !== "demo-first") return;
      if (data.step === "ask") {
        reportedRef.current = Math.max(reportedRef.current, STEP_INDEX.ask);
        setStep((current) => (current === "map" || current === "dismissed" ? "ask" : current));
      } else if (data.step === "read") {
        reportedRef.current = Math.max(reportedRef.current, STEP_INDEX.read);
        startReading();
      } else if (data.step === "list") {
        reportedRef.current = STEP_INDEX.list;
        // Still reading here: finish as soon as the answer is in; otherwise open the List now.
        if (startedCallRef.current) pendingListRef.current = true;
        else openList(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [startReading, openList]);
  useEffect(() => {
    if (pendingListRef.current && answer) openList(false);
  }, [answer, openList]);

  useStageBeat((id) => {
    const index = BEAT_STEP[id];
    if (index !== undefined) reportedRef.current = Math.max(reportedRef.current, index);
  });

  if (step === "map" || step === "dismissed") return null;
  const reading = step === "read";

  return (
    <>
      <style>{SHEET_CSS}</style>
      <div aria-hidden className="fv-scrim fixed inset-0 z-[44] mx-auto w-full max-w-[390px] bg-black/35" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-title"
        className="fv-up fixed inset-x-0 bottom-0 z-[45] mx-auto flex max-h-[calc(100dvh-56px)] w-full max-w-[390px] flex-col overflow-y-auto rounded-t-[16px] bg-card px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-[8px] text-ink shadow-[0_-2px_16px_rgba(0,0,0,0.18)]"
      >
        <span aria-hidden className="mx-auto mb-[10px] h-[4px] w-[36px] shrink-0 rounded-full bg-hairline" />
        <p className="flex items-center gap-[6px] font-display text-label font-bold">
          <MetaAiMark size={22} working={reading && !done} />
          Muse
        </p>
        {!reading ? (
          <>
            <h2 id="first-visit-title" className="mt-[8px] font-display text-[20px] font-bold leading-[25px]">
              Want Muse to build your Events feed?
            </h2>
            <p className="mt-[6px] text-body text-muted">
              Muse looks at these once to find events you would go to. Nothing is posted or sent.
            </p>
          </>
        ) : (
          <h2 id="first-visit-title" className="mt-[8px] font-display text-[20px] font-bold leading-[25px]" aria-live="polite">
            {done ? "Done. Opening your Top 3" : "Muse is reading your accounts"}
          </h2>
        )}

        <ul className="mt-[10px] flex flex-col">
          {USER3_CONNECTORS.map((source, index) => {
            const state = !reading ? null : index < ticked ? "done" : index === ticked ? "reading" : "waiting";
            return (
              <li key={source.id} className="flex min-h-[38px] items-center gap-[10px] border-b border-hairline/70 py-[4px] last:border-b-0">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-card">
                  <SourceMark mark={source.mark} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-label font-bold">{source.label}</span>
                  <span
                    key={state ?? "ask"}
                    className={`block truncate text-venue ${state === "done" ? "fv-rise text-ink" : "text-muted"}`}
                  >
                    {state === "done" ? source.found : state === "reading" ? `${source.reading}...` : source.what}
                  </span>
                </span>
                {state && <RowStatus state={state} />}
              </li>
            );
          })}
        </ul>

        <p className="mt-[8px] text-meta text-muted">Sample data for the demo, not a real account.</p>

        {!reading && (
          <div className="mt-[12px] flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={sayYes}
              className="flex h-[40px] items-center justify-center rounded-button bg-primary font-display text-label font-bold text-on-primary"
            >
              Yes, build my feed
            </button>
            <button
              type="button"
              onClick={() => setStep("dismissed")}
              className="flex h-[40px] items-center justify-center rounded-button bg-button font-display text-label font-bold text-ink"
            >
              Not now
            </button>
          </div>
        )}
        {reading && !answer && ticked >= USER3_CONNECTORS.length - 1 && (
          <p className="fv-rise mt-[4px] text-meta font-semibold text-muted">Matching what it found to this week&apos;s events</p>
        )}
      </section>
    </>
  );
}
