"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { DeckHost } from "@/components/demo/deck-host";
import { FilmPlayer, type FilmControls } from "@/components/demo/film-player";
import { SectionSlides } from "@/components/demo/section-slides";
import { StageProgress } from "@/components/demo/stage-progress";
import { StagedScreenView } from "@/components/demo/staged-screen";
import { BEATS, STORY_DUE_AFTER, castLine, castOf, deckPath, filmFiles, type Beat, type CastId } from "@/lib/demo/beats";
import { demoClock } from "@/lib/demo/clock";
import { startStagePoll, type StagePoll } from "@/lib/demo/stage-poll";
import { PERSONA_COOKIE, type PersonaId } from "@/lib/social/persona";

// The projected stage for the pitch, on Facebook's white page. One beat at a
// time: a film plays full bleed and steps through its cue points (until its
// file is in public/demo/films/, it shows as a slide); an app beat shows the real app in a large phone, playing that beat's
// persona; a staged beat shows a screen from another app that hands off with
// one tap (a staged page posts "demo-handoff" to move on without a reload;
// until a staged route exists, a placeholder stands in). Keys: Right, Space or Page Down next; Left or Page Up back; Home
// first; R reloads this beat; Shift+R resets the whole demo; H shows the beat
// list; F full screen. A presenter window on the same browser follows along
// through the "demo-stage" channel. A phone remote (/demo/remote) can move the
// show too: the stage keeps its beat in the shared store (/api/demo/stage) and
// follows any newer move within about a second. The laptop stays the master:
// if that store or the network fails, the stage keeps running on its keys.
// When the person changes, a short card says who is on now (Next skips it);
// within one person the phone cross-fades. Reset and the beat list stay off
// the projected view: they live on /demo/console and the remote (keys still work).

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const BEZEL = 12;
const FOOTER_HEIGHT = 72;
const PERSON_CARD_MS = 700;
const FADE_MS = 200;
const CHANNEL = "demo-stage";
const TOKEN_KEY = "demo-reset-token";

// deck-step tells the console (same browser) which deck step is on, for its notes.
type StageMessage = { type: "goto"; index: number } | { type: "reset" } | { type: "deck-step"; beatId: string; step: number };
// Where a move came from: this window, another window on this browser, or the store (a phone remote).
type MoveSource = "local" | "channel" | "remote";
type StagePosition = { index: number; seq: number };

const POSITION_URL = "/api/demo/stage";

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

// Fit a 390 by 844 phone into the stage at any projector size: as tall as the
// window allows, with room above and below. Under 640 px the words stack under it.
function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const phoneScale = () => {
  const byHeight = (window.innerHeight - FOOTER_HEIGHT - 48 - BEZEL * 2) / PHONE_HEIGHT;
  // Stacked under 640 px: the phone takes most of the height, the words sit below it.
  if (window.innerWidth < 640) return Math.min(byHeight * 0.64, (window.innerWidth - 32 - BEZEL * 2) / PHONE_WIDTH);
  // Side by side: the phone up to about half the width, the words beside it.
  return Math.min(byHeight, (window.innerWidth * 0.48 - BEZEL * 2) / PHONE_WIDTH);
};

async function fetchStoryEvent(): Promise<{ id: string; error: null } | { id: null; error: string }> {
  try {
    const response = await fetch("/api/demo/story", { cache: "no-store" });
    const body = (await response.json()) as { data: { id: string } | null; error: string | null };
    return body.data ? { id: body.data.id, error: null } : { id: null, error: body.error ?? "Could not load the story event" };
  } catch {
    return { id: null, error: "Could not reach the app to load the story event" };
  }
}

// A phone screen. `z` orders them (the highest shown one is on screen); a
// prefetched screen loads hidden ahead of its beat and is shown in place when the
// beat opens, because moving an iframe in the page would reload it.
type Frame = { src: string; key: string; loaded: boolean; z: number; prefetch?: boolean };

/** The screen on top: the frame with the highest z. */
function topFrame(frames: Frame[]): Frame | undefined {
  return frames.reduce<Frame | undefined>((top, frame) => (!top || frame.z > top.z ? frame : top), undefined);
}

/** Adds a screen on top, keeping only the one it fades in over. */
function withFrameOnTop(current: Frame[], frame: Omit<Frame, "z">, z: number): Frame[] {
  const top = topFrame(current);
  return [...current.filter((item) => item === top), { ...frame, z }];
}

const prefetchKey = (src: string) => `next:${src}`;

/** A film's cue points (public/demo/films/<film>.cues.json), or none when the file is missing. */
function useCues(path: string | null): number[] | undefined {
  const [known, setKnown] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!path || path in known) return;
    fetch(path, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((body: unknown) => {
        const cues = Array.isArray(body) ? body.filter((value): value is number => typeof value === "number" && value >= 0).sort((a, b) => a - b) : [];
        setKnown((ready) => ({ ...ready, [path]: cues }));
      })
      .catch(() => setKnown((ready) => ({ ...ready, [path]: [] })));
  }, [path, known]);
  return path ? known[path] : undefined;
}

/** Checks once whether each file or route exists (a staged screen, a film). */
function useExists(path: string | null): boolean | undefined {
  const [known, setKnown] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!path || path in known) return;
    fetch(path, { method: "HEAD", cache: "no-store" })
      .then((response) => setKnown((ready) => ({ ...ready, [path]: response.ok })))
      .catch(() => setKnown((ready) => ({ ...ready, [path]: false })));
  }, [path, known]);
  return path ? known[path] : undefined;
}

export function Stage() {
  const [index, setIndex] = useState(0);
  const [storyEventId, setStoryEventId] = useState<string | null>(null);
  // The phone's screens: the newest fades in over the one before, which is dropped once it shows.
  const [frames, setFrames] = useState<Frame[]>([]);
  const scale = useSyncExternalStore(subscribeToResize, phoneScale, () => 0.8);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // The person card shown when the person on screen changes.
  const [personCard, setPersonCard] = useState<CastId | null>(null);
  const personCardRef = useRef<CastId | null>(null);
  const lastCastRef = useRef<CastId | null>(null);
  // The run's clock: one fixed campus afternoon (lib/demo/clock.ts), the same for every beat.
  const [runStartedAt, setRunStartedAt] = useState(() => demoClock());
  const personaRef = useRef<PersonaId | null | undefined>(undefined);
  // The film on screen, when there is one, so Next and Back step through its cues.
  const filmRef = useRef<FilmControls | null>(null);
  const [enteredBack, setEnteredBack] = useState(false);
  // The phone's newest screen, for a beat that continues inside it.
  const lastFrameRef = useRef<HTMLIFrameElement | null>(null);
  const zRef = useRef(0);
  // Screens loaded ahead that have finished loading, by path.
  const [loadedAhead, setLoadedAhead] = useState<string[]>([]);
  // Where a staged screen last handed the phone off to (it navigated there itself).
  const [handedOffTo, setHandedOffTo] = useState<string | null>(null);
  // Where the phone is now, as far as the stage knows (a handoff moves it too).
  const locationRef = useRef<string | null>(null);
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

  const showPersonCard = useCallback((id: CastId | null) => {
    personCardRef.current = id;
    setPersonCard(id);
  }, []);

  const goTo = useCallback(
    (next: number, source: MoveSource = "local", skipSteps = false) => {
      const clamped = Math.max(0, Math.min(BEATS.length - 1, next));
      // On a deck, a film, or the opening's slides, one step forward or back moves between its cues first.
      const step = next - indexRef.current;
      const film = filmRef.current;
      if (!skipSteps && film && (step === 1 || step === -1) && (step === 1 ? film.next() : film.back())) {
        // A remote asked to move on: put the shared position back on this beat.
        if (source === "remote") {
          void writePosition(indexRef.current).then((position) => {
            if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
          });
        }
        return;
      }
      const target = BEATS[clamped];
      // A new person on screen: say who, briefly.
      // Entering a stepped beat with Back starts it at its last cue.
      setEnteredBack(clamped < indexRef.current);
      if (target && target.kind !== "slide" && target.kind !== "film" && target.kind !== "deck") {
        const cast = castOf(target.persona);
        if (cast !== lastCastRef.current) {
          lastCastRef.current = cast;
          showPersonCard(cast);
        }
      }
      indexRef.current = clamped;
      setIndex(clamped);
      if (source !== "channel") channelRef.current?.postMessage({ type: "goto", index: clamped } satisfies StageMessage);
      if (source === "local") {
        void writePosition(clamped).then((position) => {
          if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
        });
      }
    },
    [showPersonCard],
  );

  useEffect(() => {
    if (!personCard) return;
    const timer = setTimeout(() => showPersonCard(null), PERSON_CARD_MS);
    return () => clearTimeout(timer);
  }, [personCard, showPersonCard]);

  // A phone remote moves the show through the store: follow any move newer than
  // the last one seen. On load the stage first claims the record for its own beat.
  // Polls on lib/demo/stage-poll.ts's schedule: fast while the skit moves, slow when quiet, never when hidden.
  useEffect(() => {
    let stopped = false;
    let poll: StagePoll | undefined;
    void writePosition(indexRef.current).then((position) => {
      if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
      if (stopped) return;
      poll = startStagePoll(async () => {
        const position = await readPosition();
        if (!stopped && position && position.seq > lastSeqRef.current) {
          lastSeqRef.current = position.seq;
          if (position.index !== indexRef.current) goTo(position.index, "remote");
        }
        return indexRef.current;
      });
    });
    return () => {
      stopped = true;
      poll?.stop();
    };
  }, [goTo]);

  const frameLoaded = useCallback((key: string) => {
    setFrames((current) => current.map((frame) => (frame.key === key ? { ...frame, loaded: true } : frame)));
    // Once the top screen has faded in, drop the one under it.
    setTimeout(
      () =>
        setFrames((current) => {
          const top = topFrame(current);
          return top?.key === key ? current.filter((frame) => frame === top) : current;
        }),
      FADE_MS + 40,
    );
  }, []);

  // Open the beat: its persona, its screen.
  useEffect(() => {
    if (beat.kind === "slide" || beat.kind === "film" || beat.kind === "deck") return;
    const personaChanged = personaRef.current !== beat.persona;
    if (personaChanged) {
      setPersonaCookie(beat.persona);
      personaRef.current = beat.persona;
    }
    if (!beatSrc) return;
    if (personaChanged || locationRef.current !== beatSrc) {
      // Continue inside the phone already on screen when this beat follows on from it.
      const from = beat.inFrame ? BEATS.find((candidate) => candidate.id === beat.inFrame?.from) : undefined;
      const fromSrc = from?.path?.({ storyEventId, now: runStartedAt }) ?? null;
      const phone = lastFrameRef.current?.contentWindow;
      if (!personaChanged && beat.inFrame && fromSrc && locationRef.current === fromSrc && phone) {
        phone.postMessage(beat.inFrame.message, window.location.origin);
        locationRef.current = beatSrc;
        return;
      }
      locationRef.current = beatSrc;
      zRef.current += 1;
      const z = zRef.current;
      // Loaded ahead (U1b during U1a): take over that screen in place, with the same key,
      // so React keeps its iframe instead of loading it again.
      const prefetched = document.querySelector<HTMLIFrameElement>("iframe[data-prefetch]")?.getAttribute("src") === beatSrc;
      const key = prefetched ? prefetchKey(beatSrc) : String(Date.now());
      const loaded = prefetched && loadedAhead.includes(beatSrc);
      setFrames((current) => withFrameOnTop(current, { src: beatSrc, key, loaded }, z));
      if (loaded) frameLoaded(key);
    }
  }, [beat, beatSrc, storyEventId, runStartedAt, frameLoaded, loadedAhead]);

  // Load the next beat's screen hidden, when it asks for that and the same person plays it.
  const nextBeat = BEATS[index + 1];
  const prefetchSrc =
    nextBeat?.prefetch && beat.kind !== "slide" && beat.kind !== "film" && beat.kind !== "deck" && castOf(nextBeat.persona) === castOf(beat.persona)
      ? (nextBeat.path?.({ storyEventId, now: runStartedAt }) ?? null)
      : null;


  // A staged beat's route may not be built yet: use a placeholder until it is.
  const stagedPath = beat.kind === "staged" ? beatSrc : null;
  const stagedReady = useExists(stagedPath);
  const showPlaceholder = beat.kind === "staged" && (!stagedPath || stagedReady !== true);
  // The opening: its live deck when the page is there, else its rendered film, else
  // a plain slide per section. Nothing shows until the checks answer, so it never flashes.
  const deck = beat.kind === "deck" && beat.deck ? deckPath(beat.deck) : null;
  const deckReady = useExists(deck);
  const film = (beat.kind === "film" || beat.kind === "deck") && beat.film ? filmFiles(beat.film) : null;
  const filmReady = useExists(film?.video ?? null);
  const filmCues = useCues(film?.cues ?? null);
  const showDeck = deck !== null && deckReady === true;
  const playFilm = !showDeck && film !== null && filmReady === true && filmCues !== undefined;
  const opening = beat.kind === "deck" || beat.kind === "film";
  const openingChecked = (deck === null || deckReady !== undefined) && (film === null || filmReady !== undefined);
  const deckEnd = useCallback(() => goTo(indexRef.current + 1, "local", true), [goTo]);
  const deckStart = useCallback(() => goTo(indexRef.current - 1, "local", true), [goTo]);

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
    setRunStartedAt(demoClock());
    personaRef.current = undefined;
    locationRef.current = null;
    lastCastRef.current = null;
    setFrames([]);
    setStoryEventId(null);
    setStatus(null);
    goTo(0);
  }, [goTo]);

  useEffect(() => {
    if (!status || status === "Resetting the demo") return;
    const timer = setTimeout(() => setStatus(null), 6_000);
    return () => clearTimeout(timer);
  }, [status]);

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
      setHandedOffTo(data.path);
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
        // Next during the person card skips the card, not the beat.
        if (personCardRef.current) showPersonCard(null);
        else goTo(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Home") {
        goTo(0);
      } else if (event.key === "R") {
        void resetDemo();
      } else if (event.key === "r") {
        setFrames((current) => {
          const top = topFrame(current);
          return top ? [{ ...top, key: String(Date.now()), loaded: false }] : current;
        });
      } else if (event.key === "h" || event.key === "H") {
        setShowList((shown) => !shown);
      } else if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, resetDemo, showPersonCard]);

  const cast = castOf(beat.persona);
  const topScreen = topFrame(frames);
  // The next beat's screen, loading hidden under this one (see Beat.prefetch).
  // A prefetching beat's own screen stays rendered under that key until the beat takes it over.
  const aheadSrcs = [prefetchSrc, beat.prefetch && beatSrc && handedOffTo !== beatSrc ? beatSrc : null].filter(
    (src): src is string => src !== null && !frames.some((frame) => frame.src === src || frame.key === prefetchKey(src)),
  );
  const shownFrames: Frame[] = [...frames, ...aheadSrcs.map((src) => ({ src, key: prefetchKey(src), loaded: false, z: 0, prefetch: true }))];

  return (
    // The opening is near-black like its decks (#08090D), with nothing over it; the skit is Facebook's white page.
    <div className={`fixed inset-0 z-[100] flex flex-col overflow-clip ${opening ? "bg-[#08090d] text-white" : "bg-page text-ink"}`}>
      {opening && !showDeck && !playFilm && beat.sections ? (
        openingChecked ? (
          <SectionSlides key={`${beat.id}-${enteredBack}`} lines={beat.sections.map((section) => section.line)} startAtEnd={enteredBack} controls={filmRef} />
        ) : (
          <section className="flex-1" />
        )
      ) : beat.kind === "slide" || opening ? (
        <section className="flex min-h-0 flex-1 flex-col justify-center gap-[3vh] px-[8vw]">
          <h1 className="font-display text-[clamp(44px,6.2vw,104px)] leading-[1.02] font-bold tracking-[-0.02em]">{beat.title}</h1>
          <p className="max-w-[30ch] text-[clamp(22px,2.3vw,40px)] leading-[1.3] font-medium text-muted">{beat.caption}</p>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[20px] px-[16px] py-[24px] sm:flex-row sm:gap-[4vw] sm:px-[4vw]">
          <div
            className="relative shrink-0 overflow-clip rounded-[52px] bg-card shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
            style={{ width: PHONE_WIDTH * scale + BEZEL * 2, height: PHONE_HEIGHT * scale + BEZEL * 2, border: `${BEZEL}px solid #1c1e21` }}
          >
            <div className="relative" style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {showPlaceholder && beat.staged ? (
                <StagedScreenView screen={beat.staged} onHandoff={() => goTo(index + 1)} />
              ) : topScreen ? (
                shownFrames.map((frame) => (
                  <iframe
                    key={frame.key}
                    src={frame.src}
                    title={frame.prefetch ? "Next screen, loading" : `${castLine(cast)}: phone`}
                    allow="microphone; geolocation; autoplay"
                    ref={frame === topScreen ? lastFrameRef : undefined}
                    data-prefetch={frame.prefetch ? "" : undefined}
                    onLoad={() => {
                      if (frame.prefetch) setLoadedAhead((done) => (done.includes(frame.src) ? done : [...done, frame.src]));
                      else frameLoaded(frame.key);
                    }}
                    aria-hidden={frame.prefetch || undefined}
                    tabIndex={frame.prefetch ? -1 : undefined}
                    className="absolute inset-0 h-full w-full border-0 bg-card transition-opacity ease-out motion-reduce:transition-none"
                    style={{
                      zIndex: frame.z,
                      opacity: frame.prefetch ? 0 : frame !== topScreen || frame.loaded ? 1 : 0,
                      pointerEvents: frame === topScreen ? undefined : "none",
                      transitionDuration: `${FADE_MS}ms`,
                    }}
                  />
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-body text-muted">Loading the story event</div>
              )}
            </div>
          </div>
          <div className="flex w-full max-w-[600px] min-w-0 flex-col gap-[2.4vh]">
            <span className="inline-flex w-fit items-center gap-[12px] rounded-full bg-primary-soft py-[6px] pr-[18px] pl-[6px] font-display text-[clamp(16px,1.5vw,24px)] font-bold text-link">
              <CastAvatar id={cast} size={40} />
              {castLine(cast)}
            </span>
            <h1 className="font-display text-[clamp(30px,3.9vw,64px)] leading-[1.08] font-bold tracking-[-0.01em]">{beat.title}</h1>
            <p className="text-[clamp(18px,1.8vw,30px)] leading-[1.35] font-medium text-muted">{beat.caption}</p>
          </div>
        </section>
      )}

      {!opening && (
        <footer className="flex shrink-0 items-center justify-center px-[16px]" style={{ height: FOOTER_HEIGHT }}>
          <StageProgress index={index} />
        </footer>
      )}

      {showDeck && deck && <DeckHost
          key={`${deck}-${enteredBack}`}
          src={deck}
          startAtEnd={enteredBack}
          controls={filmRef}
          onEnd={deckEnd}
          onStart={deckStart}
          onStep={(step) => channelRef.current?.postMessage({ type: "deck-step", beatId: beat.id, step } satisfies StageMessage)}
        />}
      {playFilm && film && filmCues && <FilmPlayer key={film.video} src={film.video} cues={filmCues} controls={filmRef} />}

      {personCard && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[24px] bg-page motion-safe:animate-[stage-card_700ms_ease-out_both]"
        >
          <style>{"@keyframes stage-card{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}"}</style>
          <CastAvatar id={personCard} size={128} />
          <p className="font-display text-[clamp(28px,3.4vw,56px)] font-bold">Now: {castLine(personCard)}</p>
        </div>
      )}

      {status && (
        <p role="status" className="absolute top-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-body text-card">
          {status}
        </p>
      )}

      {/* The operator's beat list (H). Hidden unless asked for; reset lives on /demo/console and Shift+R. */}
      {showList && (
        <nav aria-label="Beats" className="absolute top-4 right-4 z-30 max-h-[80vh] w-[320px] overflow-y-auto rounded-card bg-card p-3 shadow-xl">
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
        </nav>
      )}
    </div>
  );
}
