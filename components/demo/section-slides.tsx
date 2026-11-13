"use client";

import { useImperativeHandle, useState, type Ref } from "react";
import type { FilmControls } from "@/components/demo/film-player";

// The opening's fallback until its deck or film exists: one plain slide per
// section, each the section's one bold line. Next and Back step through them
// like a deck's cues; past either end, the stage moves to the next or previous beat.

export function SectionSlides({ lines, startAtEnd, controls }: { lines: string[]; startAtEnd: boolean; controls: Ref<FilmControls | null> }) {
  const [step, setStep] = useState(startAtEnd ? Math.max(0, lines.length - 1) : 0);

  useImperativeHandle(controls, () => ({
    next: () => {
      if (step >= lines.length - 1) return false;
      setStep(step + 1);
      return true;
    },
    back: () => {
      if (step <= 0) return false;
      setStep(step - 1);
      return true;
    },
  }));

  return (
    <section className="flex min-h-0 flex-1 flex-col justify-center px-[8vw]">
      <h1 key={step} className="max-w-[18ch] font-display text-[clamp(40px,5.6vw,96px)] leading-[1.05] font-bold tracking-[-0.02em] motion-safe:animate-[section-in_320ms_ease-out]">
        {lines[step]}
      </h1>
      <style>{"@keyframes section-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
    </section>
  );
}
