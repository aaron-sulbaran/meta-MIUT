"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { BEATS, castLine, castOf } from "@/lib/demo/beats";

// A presenter's phone as a clicker for the /demo stage on the laptop. Next and
// Back write the stage's position (/api/demo/stage); the laptop follows within
// about a second. It shows where the show is, so whoever holds it knows their
// cue. The laptop never depends on it: if this phone loses the network, the
// laptop's keys still run the show.

type Position = { index: number; seq: number };

const POSITION_URL = "/api/demo/stage";
const POLL_MS = 1_000;

type WakeLockLike = { release: () => Promise<void> };

export function StageRemote() {
  const [position, setPosition] = useState<Position | null>(null);
  const [connected, setConnected] = useState(true);
  const seenSeq = useRef(0);
  const wakeLock = useRef<WakeLockLike | null>(null);

  const show = useCallback((next: Position | null) => {
    if (!next || next.seq < seenSeq.current) return;
    seenSeq.current = next.seq;
    setPosition(next);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(POSITION_URL, { cache: "no-store" });
        const body = (await response.json()) as { data: Position | null };
        if (!stopped) {
          setConnected(true);
          show(body.data);
        }
      } catch {
        if (!stopped) setConnected(false);
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      void wakeLock.current?.release().catch(() => {});
    };
  }, [show]);

  async function move(action: "next" | "back") {
    // Keep this phone awake for the rest of the pitch (where the browser allows it).
    if (!wakeLock.current && "wakeLock" in navigator) {
      try {
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<WakeLockLike> } }).wakeLock.request("screen");
      } catch {
        // Not allowed here: the phone may dim, the remote still works.
      }
    }
    try {
      const response = await fetch(POSITION_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { data: Position | null };
      setConnected(true);
      show(body.data);
    } catch {
      setConnected(false);
    }
  }

  const beat = position ? BEATS[position.index] : undefined;
  const upNext = position ? BEATS[position.index + 1] : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-page text-ink">
      <header className="flex items-center justify-between px-[16px] pt-[max(14px,env(safe-area-inset-top))] pb-[10px]">
        <p className="font-display text-label font-bold">Demo remote</p>
        <p className="flex items-center gap-[6px] text-meta font-semibold text-muted" role="status">
          <span aria-hidden className={`h-[8px] w-[8px] rounded-full ${connected ? "bg-[#31a24c]" : "bg-[#e41e3f]"}`} />
          {connected ? (position ? `${position.index + 1} / ${BEATS.length}` : "Waiting for the stage") : "Not connected"}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col justify-center gap-[8px] px-[20px]">
        {beat ? (
          <>
            {beat.kind === "slide" || beat.kind === "video" ? (
              <p className="text-meta font-semibold text-muted">Slide</p>
            ) : (
              <p className="inline-flex items-center gap-[8px] self-start rounded-full bg-primary-soft py-[3px] pr-[10px] pl-[3px] font-display text-[13px] font-bold text-link">
                <CastAvatar id={castOf(beat.persona)} size={22} />
                {castLine(castOf(beat.persona))}
              </p>
            )}
            <h1 className="font-display text-root-title leading-[31px] font-bold">{beat.title}</h1>
            <p className="text-body text-muted">{beat.caption}</p>
            <p className="mt-[10px] text-venue text-muted">{upNext ? `Next: ${upNext.title}` : "Last beat"}</p>
          </>
        ) : (
          <p className="text-body text-muted">
            {connected ? "Open /demo on the laptop. This phone follows it and can move it." : "This phone cannot reach the app. The laptop's keys still run the show."}
          </p>
        )}
      </main>

      <div className="flex gap-[10px] px-[16px] pt-[8px] pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void move("back")}
          className="h-[96px] flex-1 rounded-[18px] bg-button font-display text-title font-bold active:scale-[0.98]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void move("next")}
          className="h-[96px] flex-[2] rounded-[18px] bg-primary font-display text-[22px] font-bold text-on-primary active:scale-[0.98]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
