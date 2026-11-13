"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { FilmControls } from "@/components/demo/film-player";

// A deck beat: a live motion page (public/demo/deck/<name>/index.html), full bleed
// with no stage chrome, stepped by the stage over same-origin postMessage.
//   Stage to deck: {source: "demo-stage", type: "next" | "back"}, and
//                  {source: "demo-stage", type: "goto", step} (Back from the next beat: its last step).
//   Deck to stage: {source: "demo-deck", type: "ready", steps}, {type: "step", index, steps},
//                  {type: "end"} (Next on its last step), {type: "start"} (Back on its first).
// The deck decides when it is done; nothing moves on a timer. The iframe never
// takes focus, so the stage's keys keep working (the deck forwards its own keys too).

type DeckMessage = { source?: unknown; type?: unknown; steps?: unknown; index?: unknown };

export function DeckHost({
  src,
  startAtEnd,
  controls,
  onEnd,
  onStart,
  onStep,
}: {
  src: string;
  startAtEnd: boolean;
  controls: Ref<FilmControls | null>;
  onEnd: () => void;
  onStart: () => void;
  /** The step the deck reports it is on (for the presenter notes). */
  onStep?: (step: number) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const handlers = useRef({ onEnd, onStart, onStep, startAtEnd });
  useEffect(() => {
    handlers.current = { onEnd, onStart, onStep, startAtEnd };
  }, [onEnd, onStart, onStep, startAtEnd]);

  const send = (message: Record<string, unknown>) => frameRef.current?.contentWindow?.postMessage({ source: "demo-stage", ...message }, window.location.origin);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as DeckMessage | null;
      if (data?.source !== "demo-deck") return;
      if (data.type === "ready" && handlers.current.startAtEnd && typeof data.steps === "number" && data.steps > 0) {
        frameRef.current?.contentWindow?.postMessage({ source: "demo-stage", type: "goto", step: data.steps - 1 }, window.location.origin);
      }
      if (data.type === "step" && typeof data.index === "number") handlers.current.onStep?.(data.index);
      if (data.type === "end") handlers.current.onEnd();
      if (data.type === "start") handlers.current.onStart();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useImperativeHandle(controls, () => ({
    // The deck answers "end" or "start" itself when it runs out of steps.
    next: () => {
      send({ type: "next" });
      return true;
    },
    back: () => {
      send({ type: "back" });
      return true;
    },
  }));

  return (
    <iframe
      ref={frameRef}
      src={src}
      title="Opening"
      tabIndex={-1}
      onLoad={() => {
        // Keep the keys on the stage, not inside the deck.
        frameRef.current?.blur();
        window.focus();
      }}
      className="absolute inset-0 z-10 h-full w-full border-0 bg-black"
    />
  );
}
