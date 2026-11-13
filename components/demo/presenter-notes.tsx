"use client";

import { useEffect, useState } from "react";
import { BEATS, deckStepsPath, type Beat, type DeckStep } from "@/lib/demo/beats";

// What the presenter says and does, for the remote and the console only (never
// the projected stage). A deck brings its own notes (steps.json beside it), the
// step it last reported highlighted when this window knows it; without them the
// opening lists its fallback sections, one note each.

function useDeckSteps(beat: Beat): DeckStep[] | null {
  const [steps, setSteps] = useState<{ deck: string; steps: DeckStep[] | null } | null>(null);
  useEffect(() => {
    if (!beat.deck) return;
    const deck = beat.deck;
    let cancelled = false;
    fetch(deckStepsPath(deck), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (cancelled) return;
        const valid = Array.isArray(body) ? body.filter((step): step is DeckStep => typeof step?.notes === "string" && typeof step?.title === "string") : null;
        setSteps({ deck, steps: valid && valid.length > 0 ? valid : null });
      })
      .catch(() => !cancelled && setSteps({ deck, steps: null }));
    return () => {
      cancelled = true;
    };
  }, [beat.deck]);
  return steps && steps.deck === beat.deck ? steps.steps : null;
}

export function PresenterNotes({ beat, deckStep = null }: { beat: Beat; deckStep?: number | null }) {
  const deckSteps = useDeckSteps(beat);
  if (deckSteps) {
    return (
      <ol className="flex flex-col gap-[8px]">
        {deckSteps.map((step, index) => (
          <li key={step.id} className={`rounded-[10px] px-[12px] py-[9px] ${index === deckStep ? "bg-primary-soft" : "bg-wash"}`}>
            <p className="font-display text-label font-bold">
              {index + 1}. {step.title}
            </p>
            <p className="mt-[2px] text-body text-ink">{step.notes}</p>
          </li>
        ))}
      </ol>
    );
  }
  if (beat.sections) {
    return (
      <ol className="flex flex-col gap-[8px]">
        {beat.sections.map((section, index) => (
          <li key={section.name} className="rounded-[10px] bg-wash px-[12px] py-[9px]">
            <p className="font-display text-label font-bold">
              {index + 1}. {section.name}
            </p>
            <p className="mt-[2px] text-body text-ink">{section.note}</p>
          </li>
        ))}
      </ol>
    );
  }
  if (!beat.note) return null;
  return <p className="rounded-[10px] bg-wash px-[12px] py-[9px] text-body text-ink">{beat.note}</p>;
}

/** The console's notes: follows the stage's position (read only; it never moves the show). */
export function StageNotes() {
  const [index, setIndex] = useState<number | null>(null);
  // The deck step, from the stage window on this browser (it says so on the "demo-stage" channel).
  const [deckStep, setDeckStep] = useState<{ beatId: string; step: number } | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("demo-stage");
    channel.onmessage = (message: MessageEvent<{ type?: string; beatId?: string; step?: number }>) => {
      if (message.data.type === "deck-step" && typeof message.data.beatId === "string" && typeof message.data.step === "number") {
        setDeckStep({ beatId: message.data.beatId, step: message.data.step });
      }
    };
    return () => channel.close();
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch("/api/demo/stage", { cache: "no-store" });
        const body = (await response.json()) as { data: { index: number } | null };
        if (!stopped && body.data) setIndex(body.data.index);
      } catch {
        // Try again next tick.
      }
      if (!stopped) timer = setTimeout(poll, 1_500);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  const beat = index === null ? null : BEATS[index];
  return (
    <section className="flex flex-col gap-[8px] px-[16px] py-[14px]">
      <h2 className="font-display text-title font-bold">Presenter notes</h2>
      {beat ? (
        <>
          <p className="text-venue text-muted">
            {beat.id} · {beat.title}
          </p>
          <PresenterNotes beat={beat} deckStep={deckStep?.beatId === beat.id ? deckStep.step : null} />
        </>
      ) : (
        <p className="text-body text-muted">Waiting for the stage.</p>
      )}
    </section>
  );
}
