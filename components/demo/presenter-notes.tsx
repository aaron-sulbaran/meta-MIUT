"use client";

import { useEffect, useState } from "react";
import { BEATS, type Beat } from "@/lib/demo/beats";

// What the presenter says and does, for the remote and the console only (never
// the projected stage). The opening lists its sections in order, one note each.

export function PresenterNotes({ beat }: { beat: Beat }) {
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
          <PresenterNotes beat={beat} />
        </>
      ) : (
        <p className="text-body text-muted">Waiting for the stage.</p>
      )}
    </section>
  );
}
