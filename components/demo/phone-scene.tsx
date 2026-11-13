"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/demo/brand-mark";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { HelloArrival } from "@/components/demo/hello-arrival";
import { PHONE_SLUG, beatScreen, inFrameMessage, nextActStart, phoneView, storyDue, type PhoneView } from "@/lib/demo/beat-context";
import { CAST, type CastId } from "@/lib/demo/beats";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { demoClock } from "@/lib/demo/clock";
import { startStagePoll, type StagePoll } from "@/lib/demo/stage-poll";
import { PERSONA_COOKIE, type PersonaId } from "@/lib/social/persona";

// A presenter's own phone during the pitch (/demo/phone/<slug>). It follows the
// stage (polling /api/demo/stage, like the stage itself) and, on that person's
// beats, shows the same screen the stage's phone frame shows, full bleed, as
// their persona. Their real taps move the stage: a screen that hands off posts
// "demo-handoff" to its parent (lib/demo/staged.ts handOff), and this page turns
// it into a move. A small Next and Back cover the beats that move on by voice.
// The stage only accepts moves on this person's own beats (decidePhoneMove), so
// a stray tap never jumps the show; the laptop's keys and /demo/remote always win.
// The hand-over: while the stage rests on the last beat of the act before theirs,
// the next person's waiting screen shows something real to tap (Jolyn's lock
// screen alert, Lisa's invite once it is really sent, Trish's Instagram), and that
// tap starts their act ("join"). A screen can also pass the show on itself:
// {source: "demo-screen", type: "pass"} moves to the next person's first beat ("pass").
// Nothing here moves on a timer.

const NOTICE_MS = 2_500;
// A hand-over moment arrives a beat after the stage settles on the last beat before it.
const ARRIVE_MS = 1_200;
const INVITE_POLL_MS = 1_500;
// An invite counts for this run when it was sent this recently (the demo reset clears older ones anyway).
const INVITE_FRESH_MS = 15 * 60_000;

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

  // Follow the stage on lib/demo/stage-poll.ts's schedule: fast while the skit moves, slow when quiet, never when hidden.
  const pollRef = useRef<StagePoll | null>(null);
  useEffect(() => {
    let stopped = false;
    const poll = startStagePoll(async () => {
      try {
        const response = await fetch(`/api/demo/stage?phone=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const body = (await response.json()) as { data: Position | null };
        if (!stopped && !pendingRef.current) adopt(body.data ?? { index: 0, seq: 0 });
        if (!stopped) setOnline(true);
        return body.data?.index ?? null;
      } catch {
        if (!stopped) setOnline(false);
        return null;
      }
    });
    pollRef.current = poll;
    return () => {
      stopped = true;
      poll.stop();
      pollRef.current = null;
    };
  }, [slug, adopt]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const move = useCallback(
    async (action: "next" | "back" | "join" | "pass") => {
      const at = indexRef.current;
      if (at === null || pendingRef.current) return;
      pendingRef.current = true;
      // A tap inside the screen never reaches this page's listeners: keep polling fast from here.
      pollRef.current?.active();
      // Move here at once; the stage's answer settles it.
      const target = action === "back" ? at - 1 : action === "pass" ? (nextActStart(at) ?? at) : at + 1;
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
      pollRef.current?.active();
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
        // The screen passes the show to the next person (Lisa's "Open to company", Jolyn's "Sent to Lisa").
        if (heard.type === "pass") void move("pass");
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
          {/* Its own strip under the screen, so it never covers the app's text or controls. */}
          <nav aria-label="Move the stage" className="flex h-[44px] shrink-0 items-center justify-between border-t border-hairline bg-page px-[6px]" style={{ touchAction: "manipulation" }}>
            <button
              type="button"
              aria-label="Back one beat"
              disabled={index === null || index === 0 || phoneView(index - 1, cast).kind !== "scene"}
              onClick={() => void move("back")}
              className="flex h-[40px] items-center gap-[2px] rounded-full px-[10px] font-display text-label font-bold text-muted disabled:opacity-0"
            >
              <Chevron back />
              Back
            </button>
            <span className="text-meta text-muted" role="status">
              {online ? `${CAST[cast].name} is on` : "Offline, retrying"}
            </span>
            <button
              type="button"
              aria-label={view.lastOfAct && view.handsTo ? `Next: hand over to ${CAST[view.handsTo].name}` : "Next beat"}
              onClick={() => void move("next")}
              className="flex h-[40px] items-center gap-[2px] rounded-full px-[10px] font-display text-label font-bold text-link"
            >
              {view.lastOfAct && view.handsTo ? `To ${CAST[view.handsTo].name}` : "Next"}
              <Chevron />
            </button>
          </nav>
        </>
      ) : (
        <Waiting cast={cast} view={view} online={online} now={now} onJoin={() => void move("join")} />
      )}
      {notice && (
        <p role="status" className="absolute top-[max(12px,env(safe-area-inset-top))] left-1/2 z-10 w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-body text-card">
          {notice}
        </p>
      )}
    </div>
  );
}

function Waiting({ cast, view, online, now, onJoin }: { cast: CastId; view: PhoneView | null; online: boolean; now: Date; onJoin: () => void }) {
  const waiting = view?.kind === "waiting" ? view : null;
  const arrived = useArrival(cast, waiting?.canJoin === true);
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
        {arrived && <JoinMoment cast={cast} now={now} onJoin={onJoin} />}
        {/* Trish's act ends with her hi reaching Jolyn and Lisa here. */}
        <HelloArrival cast={cast} watching={waiting?.onNow === "user3" || waiting?.phase === "after"} />
        {waiting?.upNext && !arrived && (
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

/**
 * Whether the hand-over moment has arrived on this waiting screen: a beat after
 * the stage settles (Jolyn's alert, Trish's Instagram), or, for Lisa, once
 * Jolyn's invite has really been sent to her.
 */
function useArrival(cast: CastId, canJoin: boolean): boolean {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!canJoin) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (cast !== "user2") {
      timer = setTimeout(() => setArrived(true), ARRIVE_MS);
    } else {
      const check = async () => {
        try {
          const response = await fetch("/api/social/invites?to=lisa", { cache: "no-store" });
          const body = (await response.json()) as { data: { invites: { at: string }[] } | null };
          const newest = body.data?.invites.at(-1);
          if (!stopped && newest && Date.now() - Date.parse(newest.at) < INVITE_FRESH_MS) {
            setArrived(true);
            return;
          }
        } catch {
          // Try again on the next tick.
        }
        if (!stopped) timer = setTimeout(check, INVITE_POLL_MS);
      };
      void check();
    }
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      setArrived(false);
    };
  }, [cast, canJoin]);
  return canJoin && arrived;
}

const ARRIVE_CSS = "@keyframes join-in{from{opacity:0;transform:translateY(-16px) scale(0.97)}to{opacity:1;transform:none}}";

/** The real thing the next person taps to start their act. */
function JoinMoment({ cast, now, onJoin }: { cast: CastId; now: Date; onJoin: () => void }) {
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE }).replace(/\s?[AP]M$/, "");
  if (cast === "user1") {
    // Her lock screen: the alert from Muse as class ends.
    return (
      <div
        className="flex flex-col items-center rounded-[28px] px-[12px] pt-[20px] pb-[12px] text-white"
        style={{ background: "linear-gradient(165deg, #10204a 0%, #2b2a6b 45%, #6d3a7d 75%, #c76b6b 110%)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <style>{ARRIVE_CSS}</style>
        <p className="text-[56px] leading-none font-semibold tracking-[-0.02em]">{time}</p>
        <button
          type="button"
          onClick={onJoin}
          className="mt-[18px] flex w-full items-start gap-[10px] rounded-[20px] bg-white/20 px-[12px] py-[10px] text-left backdrop-blur-md motion-safe:animate-[join-in_420ms_ease-out_both]"
        >
          <BrandMark name="facebook" size={34} className="rounded-[8px]" />
          <span className="min-w-0 flex-1">
            <span className="flex justify-between text-[13px] font-semibold">
              <span>Muse</span>
              <span className="font-normal opacity-80">now</span>
            </span>
            <span className="block text-[14px] leading-[1.3]">Just out of class. Want a free bite on your walk home?</span>
          </span>
        </button>
      </div>
    );
  }
  if (cast === "user2") {
    // An Instagram notification: Jolyn's invite has arrived.
    return (
      <button
        type="button"
        onClick={onJoin}
        className="flex w-full items-center gap-[12px] rounded-[18px] border border-hairline bg-card px-[14px] py-[12px] text-left shadow-[0_6px_24px_rgba(0,0,0,0.12)] motion-safe:animate-[join-in_420ms_ease-out_both]"
        style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <style>{ARRIVE_CSS}</style>
        <BrandMark name="instagram" size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex justify-between text-[13px] text-muted">
            <span className="font-semibold text-ink">Instagram</span>
            <span>now</span>
          </span>
          <span className="block text-[14px] leading-[1.3] text-ink">
            <span className="font-semibold">{CAST.user1.name}</span> sent you an invite
          </span>
        </span>
      </button>
    );
  }
  // Trish: her Instagram, one tap to open.
  return (
    <button
      type="button"
      onClick={onJoin}
      className="mx-auto flex flex-col items-center gap-[8px] rounded-[24px] px-[16px] py-[12px] motion-safe:animate-[join-in_420ms_ease-out_both]"
    >
      <style>{ARRIVE_CSS}</style>
      <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[22px] border border-hairline bg-card shadow-[0_6px_20px_rgba(0,0,0,0.12)]">
        <BrandMark name="instagram" size={56} />
      </span>
      <span className="font-display text-label font-bold">Instagram</span>
      <span className="text-meta text-muted">Tap to open</span>
    </button>
  );
}
