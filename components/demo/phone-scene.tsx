"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { PHONE_SLUG, beatScreen, inFrameMessage, phoneView, storyDue, type PhoneView } from "@/lib/demo/beat-context";
import { CAST, type CastId } from "@/lib/demo/beats";
import { demoClock } from "@/lib/demo/clock";
import { PERSONA_COOKIE, type PersonaId } from "@/lib/social/persona";

// A presenter's own phone during the pitch (/demo/phone/<slug>). It follows the
// stage (polling /api/demo/stage, like the stage itself) and, on that person's
// beats, shows the same screen the stage's phone frame shows, full bleed, as
// their persona. Their real taps move the stage: a screen that hands off posts
// "demo-handoff" to its parent (lib/demo/staged.ts handOff), and this page turns
// it into a move. A small Next and Back cover the beats that move on by voice.
// The stage only accepts moves on this person's own beats (decidePhoneMove), so
// a stray tap never jumps the show; the laptop's keys and /demo/remote always win.
// Nothing here moves on a timer.

const POLL_MS = 200;
const HIDDEN_POLL_MS = 2_000;
const NOTICE_MS = 2_500;

type Position = { index: number; seq: number };
type Frame = { src: string; key: number };

function setPersonaCookie(persona: PersonaId | null) {
  document.cookie = persona
    ? `${PERSONA_COOKIE}=${encodeURIComponent(persona)}; path=/; SameSite=Lax`
    : `${PERSONA_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function PhoneScene({ cast }: { cast: CastId }) {
  const slug = PHONE_SLUG[cast];
  const [position, setPosition] = useState<Position | null>(null);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [storyEventId, setStoryEventId] = useState<string | null>(null);
  // The run's clock: the same fixed campus afternoon the stage uses (lib/demo/clock.ts).
  const [now] = useState(() => demoClock());
  const [frame, setFrame] = useState<Frame | null>(null);
  const seqRef = useRef(0);
  const indexRef = useRef<number | null>(null);
  // A move of ours in flight: polls wait for its answer, so the screen never flicks back.
  const pendingRef = useRef(false);
  const locationRef = useRef<string | null>(null);
  const personaRef = useRef<PersonaId | null | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const adopt = useCallback((next: Position | null) => {
    if (!next || next.seq < seqRef.current) return;
    seqRef.current = next.seq;
    indexRef.current = next.index;
    setPosition({ index: next.index, seq: next.seq });
  }, []);

  // Follow the stage.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (timer) clearTimeout(timer);
      try {
        const response = await fetch(`/api/demo/stage?phone=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const body = (await response.json()) as { data: Position | null };
        if (!stopped && !pendingRef.current) adopt(body.data ?? { index: 0, seq: 0 });
        if (!stopped) setOnline(true);
      } catch {
        if (!stopped) setOnline(false);
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    }
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, adopt]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const move = useCallback(
    async (action: "next" | "back") => {
      const at = indexRef.current;
      if (at === null || pendingRef.current) return;
      pendingRef.current = true;
      // Move here at once; the stage's answer settles it.
      const target = action === "next" ? at + 1 : at - 1;
      indexRef.current = target;
      setPosition((current) => (current ? { ...current, index: target } : current));
      try {
        const response = await fetch("/api/demo/stage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, from: cast, at }),
        });
        const body = (await response.json()) as { data: Position | null; error: string | null };
        pendingRef.current = false;
        if (!response.ok && body.error) setNotice(body.error);
        adopt(body.data);
      } catch {
        pendingRef.current = false;
        indexRef.current = at;
        setPosition((current) => (current ? { ...current, index: at } : current));
        setNotice("Could not reach the stage. Try again, or use the laptop.");
      }
    },
    [cast, adopt],
  );

  const index = position?.index ?? null;
  const view: PhoneView | null = index === null ? null : phoneView(index, cast);

  // The story event, once the organizer act is over (the same rule as the stage).
  const due = index !== null && storyDue(index);
  useEffect(() => {
    if (!due) return;
    let cancelled = false;
    fetch("/api/demo/story", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { data: { id: string } | null }) => {
        if (!cancelled && body.data) setStoryEventId(body.data.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      // Back in the organizer act (a reset): the next run has a new story event.
      setStoryEventId(null);
    };
  }, [due]);

  const sceneBeat = view?.kind === "scene" ? view.beat : null;
  const screen = sceneBeat ? beatScreen(sceneBeat, { storyEventId, now }) : null;

  // Open this person's beat: their persona, the stage's screen for it.
  useEffect(() => {
    if (!sceneBeat) {
      // Not this person's beat: the screen is not shown, and the next beat of theirs loads fresh.
      locationRef.current = null;
      return;
    }
    const tellBeat = () => iframeRef.current?.contentWindow?.postMessage({ type: "demo-beat", id: sceneBeat.id }, window.location.origin);
    if (!screen) return;
    const personaChanged = personaRef.current !== sceneBeat.persona;
    if (personaChanged) {
      setPersonaCookie(sceneBeat.persona);
      personaRef.current = sceneBeat.persona;
    }
    if (!personaChanged && locationRef.current === screen) {
      tellBeat();
      return;
    }
    const message = personaChanged ? null : inFrameMessage(sceneBeat, locationRef.current, { storyEventId, now });
    const phone = iframeRef.current?.contentWindow;
    if (message && phone) {
      phone.postMessage(message, window.location.origin);
      locationRef.current = screen;
      tellBeat();
      return;
    }
    locationRef.current = screen;
    setFrame({ src: screen, key: Date.now() });
  }, [sceneBeat, screen, storyEventId, now]);

  // What the screen heard (U1c: the mic opened or closed, the transcript came back): put it
  // in the stage record, so the projected stage shows it live. The stage refuses it off this person's beat.
  const signal = useCallback(
    (kind: "listening" | "said", detail: { on?: boolean; text?: string }) => {
      const at = indexRef.current;
      if (at === null) return;
      void fetch("/api/demo/stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "signal", from: cast, at, kind, ...detail }),
      }).catch(() => {});
    },
    [cast],
  );

  // A screen's real tap (Share, Post, the invite card...): it is already on the next screen; move the stage.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const heard = event.data as { source?: unknown; type?: unknown; on?: unknown; text?: unknown } | null;
      if (heard?.source === "demo-screen") {
        if (heard.type === "listening" && typeof heard.on === "boolean") signal("listening", { on: heard.on });
        if (heard.type === "said" && typeof heard.text === "string") signal("said", { text: heard.text.slice(0, 600) });
        return;
      }
      const data = event.data as { type?: unknown; path?: unknown } | null;
      if (data?.type !== "demo-handoff" || typeof data.path !== "string" || !data.path.startsWith("/")) return;
      locationRef.current = data.path;
      void move("next");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [move, signal]);

  return (
    // The real device clips, not a drawn frame: size by the visible viewport (100dvh, so Safari's
    // toolbars never cover the app's tab bar) and keep the screen inside the safe areas (notch, home bar).
    <div
      className="fixed inset-x-0 top-0 z-[100] flex h-[100dvh] flex-col overflow-clip bg-page text-ink"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {view?.kind === "scene" ? (
        <>
          {frame ? (
            <iframe
              key={frame.key}
              ref={iframeRef}
              src={frame.src}
              title={`${CAST[cast].name}: phone`}
              allow="microphone; autoplay; geolocation"
              onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: "demo-beat", id: view.beat.id }, window.location.origin)}
              className="min-h-0 w-full flex-1 border-0 bg-card"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-body text-muted">Loading your screen</div>
          )}
          <nav
            aria-label="Move the stage"
            className="absolute flex flex-col items-end gap-[8px]"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom))", right: "calc(8px + env(safe-area-inset-right))", touchAction: "manipulation" }}
          >
            <button
              type="button"
              aria-label="Back one beat"
              disabled={index === null || index === 0 || phoneView(index - 1, cast).kind !== "scene"}
              onClick={() => void move("back")}
              className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-0"
            >
              <Chevron back />
            </button>
            <button
              type="button"
              aria-label={view.lastOfAct && view.handsTo ? `Next: hand over to ${CAST[view.handsTo].name}` : "Next beat"}
              onClick={() => void move("next")}
              className="flex h-[40px] min-w-[40px] items-center justify-center gap-[2px] rounded-full bg-black/35 px-[11px] font-display text-label font-bold text-white backdrop-blur"
            >
              {view.lastOfAct && view.handsTo ? <span className="pl-[4px]">{CAST[view.handsTo].name}</span> : null}
              <Chevron />
            </button>
            {!online && <span className="rounded-full bg-black/60 px-[10px] py-[4px] text-meta text-white">Offline</span>}
          </nav>
        </>
      ) : (
        <Waiting cast={cast} view={view} online={online} />
      )}
      {notice && (
        <p role="status" className="absolute top-[max(12px,env(safe-area-inset-top))] left-1/2 z-10 w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-body text-card">
          {notice}
        </p>
      )}
    </div>
  );
}

function Waiting({ cast, view, online }: { cast: CastId; view: PhoneView | null; online: boolean }) {
  const waiting = view?.kind === "waiting" ? view : null;
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[20px] pt-[clamp(16px,6dvh,56px)] pb-[24px]">
      <div className="flex flex-col items-center gap-[12px] text-center">
        <CastAvatar id={cast} size={96} />
        <div>
          <h1 className="font-display text-[28px] leading-[1.1] font-bold">{CAST[cast].name}</h1>
          <p className="mt-[4px] text-body text-muted">{CAST[cast].role}</p>
        </div>
      </div>

      <section className="mt-[32px] flex flex-col gap-[12px]">
        {waiting?.upNext && (
          <p role="status" className="rounded-card bg-primary-soft px-[16px] py-[14px] text-center font-display text-title font-bold text-link">
            You&apos;re up next
          </p>
        )}
        <div className="flex items-center gap-[12px] rounded-card border border-hairline bg-card px-[16px] py-[14px]">
          {waiting?.onNow ? <CastAvatar id={waiting.onNow} size={40} /> : null}
          <div className="min-w-0">
            <p className="text-meta font-semibold text-muted">{waiting?.phase === "after" ? "The show" : "On now"}</p>
            <p className="font-display text-label font-bold">
              {!waiting
                ? "Finding the stage"
                : waiting.onNow
                  ? `${CAST[waiting.onNow].name} · ${CAST[waiting.onNow].role}`
                  : waiting.phase === "before"
                    ? "The pitch is starting"
                    : waiting.phase === "after"
                      ? "That's a wrap. Thank you!"
                      : "The pitch"}
            </p>
          </div>
        </div>
      </section>

      <p className="mt-auto text-center text-venue text-muted">
        {online ? "Keep this open. Your screen appears here on your turn." : "Can't reach the stage right now. Retrying."}
      </p>
    </main>
  );
}
