"use client";

import { useEffect, useState } from "react";
import { startStagePoll } from "@/lib/demo/stage-poll";
import { BEATS, deckStepsPath, type Beat, type DeckLead, type DeckStep } from "@/lib/demo/beats";

// What the presenter says and does, for the remote and the console only (never
// the projected stage). A deck brings its own notes (steps.json beside it), the
// step it last reported highlighted when this window knows it; without them the
// opening lists its fallback sections, one note each. A step that says who leads
// shows it: "Screen leads: stay quiet" with the note as a stage direction, or
// "You" with the line large enough to read at arm's length; then what the next
// click brings, in small type.

const LEAD_LABEL: Record<DeckLead, string> = { screen: "Screen leads: stay quiet", speaker: "You" };

/** A step's label: who leads it, or its title when it does not say. */
function stepLabel(step: DeckStep): string {
  return step.lead ? LEAD_LABEL[step.lead] : step.title;
}

/** The first few words of a note, for the look ahead. */
function firstWords(text: string, count = 7): string {
  const words = text.trim().split(/\s+/);
  return words.length > count ? `${words.slice(0, count).join(" ")}...` : words.join(" ");
}

function CurrentStep({ step, next }: { step: DeckStep; next: DeckStep | undefined }) {
  return (
    <div className="flex flex-col gap-[8px] rounded-[12px] bg-primary-soft px-[14px] py-[12px]">
      {step.lead === "screen" ? (
        <>
          <p className="w-fit rounded-full bg-ink px-[10px] py-[3px] font-display text-label font-bold text-card">{LEAD_LABEL.screen}</p>
          <p className="text-body text-muted italic">{step.notes}</p>
        </>
      ) : step.lead === "speaker" ? (
        <>
          <p className="w-fit rounded-full bg-primary px-[10px] py-[3px] font-display text-label font-bold text-on-primary">{LEAD_LABEL.speaker}</p>
          <p className="text-[24px] leading-[1.3] font-semibold text-ink">{step.notes}</p>
        </>
      ) : (
        <>
          <p className="font-display text-label font-bold">{step.title}</p>
          <p className="text-body text-ink">{step.notes}</p>
        </>
      )}
      <p className="border-t border-hairline pt-[6px] text-meta text-muted">
        {next ? (
          <>
            Next: <span className="font-semibold">{stepLabel(next)}</span> · {firstWords(next.notes)}
          </>
        ) : (
          "Last step of this deck"
        )}
      </p>
    </div>
  );
}

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
        const valid = Array.isArray(body)
          ? body
              .filter((step): step is DeckStep => typeof step?.notes === "string" && typeof step?.title === "string")
              .map((step) => ({ id: step.id, title: step.title, notes: step.notes, ...(step.lead === "screen" || step.lead === "speaker" ? { lead: step.lead } : {}) }))
          : null;
        setSteps({ deck, steps: valid && valid.length > 0 ? valid : null });
      })
      .catch(() => !cancelled && setSteps({ deck, steps: null }));
    return () => {
      cancelled = true;
    };
  }, [beat.deck]);
  return steps && steps.deck === beat.deck ? steps.steps : null;
}

/** `currentOnly` (the phone remote): once the deck step is known, only that step and the look ahead, readable at arm's length. */
export function PresenterNotes({ beat, deckStep = null, currentOnly = false }: { beat: Beat; deckStep?: number | null; currentOnly?: boolean }) {
  const deckSteps = useDeckSteps(beat);
  if (deckSteps) {
    const current = deckStep !== null ? deckSteps[deckStep] : undefined;
    if (current && deckStep !== null && currentOnly) return <CurrentStep step={current} next={deckSteps[deckStep + 1]} />;
    return (
      <div className="flex flex-col gap-[10px]">
        {current && deckStep !== null && <CurrentStep step={current} next={deckSteps[deckStep + 1]} />}
        <ol className="flex flex-col gap-[8px]">
          {deckSteps.map((step, index) => (
            <li key={step.id} className={`rounded-[10px] px-[12px] py-[9px] ${index === deckStep ? "bg-primary-soft" : "bg-wash"}`}>
              <p className="font-display text-label font-bold">
                {index + 1}. {step.title}
                {step.lead && <span className="ml-[6px] font-normal text-muted">· {step.lead === "screen" ? "Screen leads" : "You"}</span>}
              </p>
              <p className={`mt-[2px] text-body ${step.lead === "screen" ? "text-muted italic" : "text-ink"}`}>{step.notes}</p>
            </li>
          ))}
        </ol>
      </div>
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
  // Polls on lib/demo/stage-poll.ts's schedule: fast while the skit moves, slow when quiet, never when hidden.
  useEffect(() => {
    let stopped = false;
    const poll = startStagePoll(async () => {
      try {
        const response = await fetch("/api/demo/stage", { cache: "no-store" });
        const body = (await response.json()) as { data: { index: number; deck?: { name: string; step: number } | null } | null };
        if (!stopped && body.data) {
          setIndex(body.data.index);
          // The shared record carries the deck step too, for a console on another machine.
          const deck = body.data.deck;
          const onBeat = BEATS[body.data.index];
          if (deck && onBeat?.deck === deck.name) setDeckStep({ beatId: onBeat.id, step: deck.step });
        }
        return body.data?.index ?? null;
      } catch {
        return null;
      }
    });
    return () => {
      stopped = true;
      poll.stop();
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
