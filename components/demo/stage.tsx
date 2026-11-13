"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StagedScreenView } from "@/components/demo/staged-screen";
import { ACT_LABELS, BEATS, PERSONA_CAPTIONS, STORY_DUE_AFTER, type Beat } from "@/lib/demo/beats";
import { PERSONA_COOKIE, type PersonaId } from "@/lib/social/persona";

// The projected stage for the pitch. One beat at a time: a slide fills the
// stage; an app beat shows the real app in a phone, playing that beat's
// persona; a staged beat shows a screen from another app that hands off with
// one tap (a staged page posts "demo-handoff" to move on without a reload;
// until a staged route exists, a placeholder stands in). Keys: Right, Space or Page Down next; Left or Page Up back; Home
// first; R reloads this beat; Shift+R resets the whole demo; H shows the beat
// list; F full screen. A presenter window on the same browser follows along
// through the "demo-stage" channel. A phone remote (/demo/remote) can move the
// show too: the stage keeps its beat in the shared store (/api/demo/stage) and
// follows any newer move within about a second. The laptop stays the master:
// if that store or the network fails, the stage keeps running on its keys.

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const CHANNEL = "demo-stage";
const TOKEN_KEY = "demo-reset-token";

type StageMessage = { type: "goto"; index: number } | { type: "reset" };
// Where a move came from: this window, another window on this browser, or the store (a phone remote).
type MoveSource = "local" | "channel" | "remote";
type StagePosition = { index: number; seq: number };

const POSITION_URL = "/api/demo/stage";
const POSITION_POLL_MS = 1_000;

async function readPosition(): Promise<StagePosition | null> {
  try {
    const response = await fetch(POSITION_URL, { cache: "no-store" });
    const body = (await response.json()) as { data: StagePosition | null };
    return body.data;
  } catch {
    return null;
  }
}

async function writePosition(index: number): Promise<StagePosition | null> {
  try {
    const response = await fetch(POSITION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "goto", index }),
    });
    const body = (await response.json()) as { data: StagePosition | null };
    return body.data;
  } catch {
    return null;
  }
}

function setPersonaCookie(persona: PersonaId | null) {
  document.cookie = persona
    ? `${PERSONA_COOKIE}=${encodeURIComponent(persona)}; path=/; SameSite=Lax`
    : `${PERSONA_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

// Fit a 390 by 844 phone into the stage at any projector size.
function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const phoneScale = () => Math.min((window.innerHeight * 0.86) / PHONE_HEIGHT, (window.innerWidth * 0.42) / PHONE_WIDTH);

async function fetchStoryEvent(): Promise<{ id: string; error: null } | { id: null; error: string }> {
  try {
    const response = await fetch("/api/demo/story", { cache: "no-store" });
    const body = (await response.json()) as { data: { id: string } | null; error: string | null };
    return body.data ? { id: body.data.id, error: null } : { id: null, error: body.error ?? "Could not load the story event" };
  } catch {
    return { id: null, error: "Could not reach the app to load the story event" };
  }
}

function personaCaption(persona: PersonaId | null): string {
  return PERSONA_CAPTIONS[persona ?? "aaron"];
}

export function Stage() {
  const [index, setIndex] = useState(0);
  const [storyEventId, setStoryEventId] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ src: string; key: number } | null>(null);
  const scale = useSyncExternalStore(subscribeToResize, phoneScale, () => 0.8);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // The run's clock: every beat's times count from it. It is stamped again when
  // the first live beat opens (the stage may sit open long before the pitch),
  // and a reset starts a new run.
  const [runStartedAt, setRunStartedAt] = useState(() => new Date());
  const clockStamped = useRef(false);
  const personaRef = useRef<PersonaId | null | undefined>(undefined);
  // Where the phone is now, as far as the stage knows (a handoff moves it too).
  const locationRef = useRef<string | null>(null);
  // Staged routes checked so far: true when the route exists.
  const [stagedReady, setStagedReady] = useState<Record<string, boolean>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  // The newest stage move this window has seen in the store, and its own beat, for the remote.
  const lastSeqRef = useRef(0);
  const indexRef = useRef(0);

  const beat: Beat = BEATS[index] ?? BEATS[0]!;

  // The story event is loaded (or quietly created) only once the organizer act
  // is over or skipped. Earlier, Muse would see it at O3 as a repost and the
  // organizer would update a listing instead of publishing a new event.
  const storyDue = index > STORY_DUE_AFTER;
  useEffect(() => {
    if (!storyDue || storyEventId) return;
    let cancelled = false;
    fetchStoryEvent().then((result) => {
      if (cancelled) return;
      if (result.id) setStoryEventId(result.id);
      else setStatus(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [storyDue, storyEventId]);
  const beatSrc = beat.path ? beat.path({ storyEventId, now: runStartedAt }) : null;

  const goTo = useCallback((next: number, source: MoveSource = "local") => {
    const clamped = Math.max(0, Math.min(BEATS.length - 1, next));
    if (!clockStamped.current && BEATS[clamped]?.kind !== "slide") {
      clockStamped.current = true;
      setRunStartedAt(new Date());
    }
    indexRef.current = clamped;
    setIndex(clamped);
    if (source !== "channel") channelRef.current?.postMessage({ type: "goto", index: clamped } satisfies StageMessage);
    if (source === "local") {
      void writePosition(clamped).then((position) => {
        if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
      });
    }
  }, []);

  // A phone remote moves the show through the store: follow any move newer than
  // the last one seen. On load the stage first claims the record for its own beat.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      const position = await readPosition();
      if (!stopped && position && position.seq > lastSeqRef.current) {
        lastSeqRef.current = position.seq;
        if (position.index !== indexRef.current) goTo(position.index, "remote");
      }
      if (!stopped) timer = setTimeout(poll, POSITION_POLL_MS);
    }
    void writePosition(indexRef.current).then((position) => {
      if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
      if (!stopped) void poll();
    });
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [goTo]);

  // Open the beat: its persona, its screen.
  useEffect(() => {
    if (beat.kind === "slide") return;
    const personaChanged = personaRef.current !== beat.persona;
    if (personaChanged) {
      setPersonaCookie(beat.persona);
      personaRef.current = beat.persona;
    }
    if (!beatSrc) return;
    if (personaChanged || locationRef.current !== beatSrc) {
      locationRef.current = beatSrc;
      setFrame({ src: beatSrc, key: Date.now() });
    }
  }, [beat, beatSrc]);

  // A staged beat's route may not be built yet: check once, use a placeholder until it is.
  const stagedPath = beat.kind === "staged" ? beatSrc : null;
  useEffect(() => {
    if (!stagedPath || stagedPath in stagedReady) return;
    fetch(stagedPath, { method: "HEAD", cache: "no-store" })
      .then((response) => setStagedReady((ready) => ({ ...ready, [stagedPath]: response.ok })))
      .catch(() => setStagedReady((ready) => ({ ...ready, [stagedPath]: false })));
  }, [stagedPath, stagedReady]);
  const showPlaceholder = beat.kind === "staged" && (!stagedPath || stagedReady[stagedPath] !== true);

  const resetDemo = useCallback(async () => {
    setStatus("Resetting the demo");
    let token = readToken();
    let response = await fetch("/api/demo/reset", {
      method: "POST",
      headers: token ? { "x-demo-token": token } : {},
    }).catch(() => null);
    if (response?.status === 403) {
      token = window.prompt("Demo reset token") ?? "";
      try {
        window.sessionStorage.setItem(TOKEN_KEY, token);
      } catch {
        // Private window: ask again next time.
      }
      response = await fetch("/api/demo/reset", { method: "POST", headers: { "x-demo-token": token } }).catch(() => null);
    }
    if (!response?.ok) {
      setStatus("Reset failed; the demo data was not changed");
      return;
    }
    setRunStartedAt(new Date());
    clockStamped.current = false;
    personaRef.current = undefined;
    locationRef.current = null;
    setFrame(null);
    setStoryEventId(null);
    setStatus(null);
    goTo(0);
  }, [goTo]);

  // Presenter windows on the same browser stay in step.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (message: MessageEvent<StageMessage>) => {
      if (message.data.type === "goto") goTo(message.data.index, "channel");
      if (message.data.type === "reset") void resetDemo();
    };
    return () => channel.close();
  }, [goTo, resetDemo]);

  // A staged screen's last tap: the phone is already on the next path, so move on without reloading it.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; path?: unknown } | null;
      if (data?.type !== "demo-handoff" || typeof data.path !== "string" || !data.path.startsWith("/")) return;
      locationRef.current = data.path;
      goTo(index + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [goTo, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goTo(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Home") {
        goTo(0);
      } else if (event.key === "R") {
        void resetDemo();
      } else if (event.key === "r") {
        setFrame((current) => (current ? { ...current, key: Date.now() } : current));
      } else if (event.key === "h" || event.key === "H") {
        setShowList((shown) => !shown);
      } else if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beat.id, goTo, index, resetDemo]);

  const progress = `${index + 1} / ${BEATS.length}`;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-wash text-ink">
      {beat.kind === "slide" ? (
        <section className="flex flex-1 flex-col justify-center gap-6 px-[8vw]">
          <p className="font-display text-[clamp(16px,1.6vw,26px)] font-bold text-muted">
            {ACT_LABELS[beat.act]}
          </p>
          <h1 className="font-display text-[clamp(44px,6vw,104px)] leading-[1.02] font-extrabold tracking-[-0.02em]">{beat.title}</h1>
          <p className="max-w-[28ch] text-[clamp(26px,2.8vw,48px)] leading-[1.25] font-medium text-muted">
            {beat.caption}
          </p>
        </section>
      ) : (
        <section className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-[5vw] px-[6vw]">
          <div
            className="relative overflow-hidden rounded-[48px] border-[10px] border-ink bg-card shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
            style={{ width: PHONE_WIDTH * scale + 20, height: PHONE_HEIGHT * scale + 20 }}
          >
            <div style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {showPlaceholder && beat.staged ? (
                <StagedScreenView screen={beat.staged} onHandoff={() => goTo(index + 1)} />
              ) : frame ? (
                <iframe
                  key={frame.key}
                  src={frame.src}
                  title={`${personaCaption(beat.persona)}: phone`}
                  allow="microphone; geolocation; autoplay"
                  className="h-full w-full border-0 bg-card"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-body text-muted">Loading the story event</div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <p className="font-display text-[clamp(14px,1.4vw,22px)] font-bold text-muted">
              {ACT_LABELS[beat.act]}
            </p>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 font-display text-[clamp(16px,1.5vw,24px)] font-bold text-link">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
              {personaCaption(beat.persona)}
            </span>
            <h1 className="font-display text-[clamp(30px,3.4vw,60px)] leading-[1.05] font-extrabold tracking-[-0.01em]">{beat.title}</h1>
            <p className="max-w-[26ch] text-[clamp(22px,2.3vw,40px)] leading-[1.3] font-medium text-muted">{beat.caption}</p>
          </div>
        </section>
      )}

      <footer className="flex items-center gap-4 px-[6vw] pb-5">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-button" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / BEATS.length) * 100}%` }} />
        </div>
        <span className="font-display text-[clamp(14px,1.2vw,20px)] font-bold text-muted tabular-nums">{progress}</span>
      </footer>

      {status && (
        <p role="status" className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-body text-card">
          {status}
        </p>
      )}

      {showList && (
        <nav aria-label="Beats" className="absolute top-4 right-4 max-h-[80vh] w-[320px] overflow-y-auto rounded-card bg-card p-3 shadow-xl">
          <ol className="flex flex-col gap-1">
            {BEATS.map((item, itemIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(itemIndex)}
                  className={`w-full rounded-[8px] px-3 py-2 text-left text-body ${itemIndex === index ? "bg-primary-soft text-link" : "hover:bg-wash"}`}
                >
                  <span className="font-display font-bold">{item.id}</span> {item.title}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => void resetDemo()} className="mt-3 w-full rounded-button bg-button py-2 font-display text-label font-bold">
            Reset the demo
          </button>
          <p className="mt-2 text-meta text-muted">Keys: arrows or clicker to move, R reload beat, Shift+R reset, H this list, F full screen.</p>
        </nav>
      )}
    </div>
  );
}
