"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { DeckHost } from "@/components/demo/deck-host";
import { FilmPlayer, type FilmControls } from "@/components/demo/film-player";
import { useHeadStart } from "@/components/demo/head-start";
import { PHONE_OUTER_HEIGHT, PHONE_OUTER_WIDTH, PhoneFrame } from "@/components/demo/phone-frame";
import { SectionSlides } from "@/components/demo/section-slides";
import { StageProgress } from "@/components/demo/stage-progress";
import { StagedScreenView } from "@/components/demo/staged-screen";
import { catchesUpOnRemoteStep, entersAtLastStep, followsAsBeatMove } from "@/lib/demo/deck-entry";
import { BEATS, STORY_DUE_AFTER, castLine, castOf, deckPath, filmFiles, type Beat, type BeatContext, type CastId } from "@/lib/demo/beats";
import { beatCast, beatScreen, inFrameMessage, stageOnLoad, nextActStart } from "@/lib/demo/beat-context";
import { demoClock } from "@/lib/demo/clock";
import { phoneChromeFor } from "@/lib/demo/phone-chrome";
import { shouldReveal } from "@/lib/demo/reveal";
import { clearClientDemoState, isStaleRun, lastMoveLabel, requestFreshRun } from "@/lib/demo/run";
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
// When the person changes, a card says who is on now for about two seconds (Next skips it);
// within one person the phone cuts to the next screen once it has loaded. Reset and the beat list stay off
// the projected view: they live on /demo/console and the remote (keys still work).

const FOOTER_HEIGHT = 72;
// The card holds fully readable for PERSON_CARD_HOLD_MS, with a fade on each side.
const PERSON_CARD_FADE_MS = 300;
const PERSON_CARD_HOLD_MS = 1500;
const PERSON_CARD_MS = PERSON_CARD_HOLD_MS + 2 * PERSON_CARD_FADE_MS;
const CARD_FADE_PCT = Math.round((PERSON_CARD_FADE_MS / PERSON_CARD_MS) * 100);
// A cut between screens: a cross-fade showed two different screens half over each other.
const FADE_MS = 0;
const CHANNEL = "demo-stage";

// deck-step tells the console (same browser) which deck step is on, for its notes.
type StageMessage = { type: "goto"; index: number; fresh?: boolean } | { type: "reset" } | { type: "deck-step"; beatId: string; step: number };
// Where a move came from: this window, another window on this browser, or the store (a phone remote).
type MoveSource = "local" | "channel" | "remote";
// The shared stage record: where the show is, a deck's step, and what the presenter's phone heard.
type StageSignal = { from: string; kind: "listening" | "said" | "failed"; on?: boolean; text?: string; at: string };
type StagePosition = { index: number; seq: number; by?: "stage" | "control"; control?: { seq: number; from: number; to: number }; run?: string; at?: string; movedAt?: string; furthest?: number; deck?: { name: string; step: number; steps?: number } | null; signal?: StageSignal | null };

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

// `undo`: the beat a remote move put the record on, when this stage stepped a deck instead.
async function writePosition(index: number, undo?: number): Promise<StagePosition | null> {
  try {
    const response = await fetch(POSITION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "goto", index, ...(undo !== undefined ? { undo } : {}) }),
    });
    const body = (await response.json()) as { data: StagePosition | null };
    return body.data;
  } catch {
    return null;
  }
}

/** Tells the shared record which deck step is on screen, so a phone remote shows its note. */
function writeDeckStep(at: number, name: string, step: number, steps: number | undefined) {
  void fetch(POSITION_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "deck", at, name, step, ...(steps ? { steps } : {}) }),
  }).catch(() => {});
}

function setPersonaCookie(persona: PersonaId | null) {
  document.cookie = persona
    ? `${PERSONA_COOKIE}=${encodeURIComponent(persona)}; path=/; SameSite=Lax`
    : `${PERSONA_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

// Fit a 390 by 844 phone into the stage at any projector size: as tall as the
// window allows, with room above and below. Under 640 px the words stack under it.
function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
// The whole phone, bezel included, scales as one piece (components/demo/phone-frame.tsx).
const phoneScale = () => {
  const byHeight = (window.innerHeight - FOOTER_HEIGHT - 48) / PHONE_OUTER_HEIGHT;
  // Stacked under 640 px: the phone takes most of the height, the words sit below it.
  if (window.innerWidth < 640) return Math.min(byHeight * 0.64, (window.innerWidth - 32) / PHONE_OUTER_WIDTH);
  // Side by side: the phone up to about half the width, the words beside it.
  return Math.min(byHeight, (window.innerWidth * 0.48) / PHONE_OUTER_WIDTH);
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

/** The screen a beat loads ahead: its held path when it has one, else its own screen. */
function aheadPath(beat: Beat, context: BeatContext): string | null {
  return beat.prefetchPath?.(context) ?? beatScreen(beat, context);
}

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
  const framesRef = useRef(frames);
  useEffect(() => {
    framesRef.current = frames;
  });
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
  // A held screen (Beat.prefetchPath) waiting for "reveal" once it is on top.
  const revealKeyRef = useRef<string | null>(null);
  // Screens that said they are ready (by frame key).
  const readyKeysRef = useRef(new Set<string>());
  // The newest phone signal already passed into the stage's phone.
  const lastSignalRef = useRef<string | null>(null);
  // True once the phone on screen was asked a request in its own words (spoken here or
  // on the presenter's phone): the beat that continues it never sends the scripted line over them.
  const spokenRef = useRef(false);
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
  // The run on screen (lib/demo/run.ts): a new id in the record means a fresh run started somewhere.
  const runRef = useRef<string | null>(null);
  // The newest control move (the remote, a phone) this stage has applied, by its seq.
  const controlSeenRef = useRef(0);
  // startOver (below), for the store poll, which starts before it is defined.
  const startOverRef = useRef<() => void>(() => {});
  // The quiet fresh-run control on the first beat: shown until the show leaves it.
  const [leftStart, setLeftStart] = useState(false);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [confirmFresh, setConfirmFresh] = useState(false);
  // Counts fresh runs seen here, so the opening deck restarts from its first step.
  const [runCount, setRunCount] = useState(0);

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
  const beatSrc = beatScreen(beat, { storyEventId, now: runStartedAt });
  useHeadStart(beat, { storyEventId, now: runStartedAt });

  const showPersonCard = useCallback((id: CastId | null) => {
    personCardRef.current = id;
    setPersonCard(id);
  }, []);

  const goTo = useCallback(
    (next: number, source: MoveSource = "local", skipSteps = false, freshRun = false) => {
      const clamped = Math.max(0, Math.min(BEATS.length - 1, next));
      // On a deck, a film, or the opening's slides, one step forward or back moves between its cues first.
      const step = next - indexRef.current;
      const film = filmRef.current;
      if (!skipSteps && film && (step === 1 || step === -1) && (step === 1 ? film.next() : film.back())) {
        // A remote asked to move on: put the shared position back on this beat.
        // Only while the record still sits on that move, so a following stage never pulls the show back.
        if (source === "remote") {
          void writePosition(indexRef.current, clamped).then((position) => {
            if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
          });
        }
        return;
      }
      const target = BEATS[clamped];
      // A new person on screen: say who, briefly.
      // A single Back into a stepped beat starts it at its last cue; a jump or a fresh run starts at its first.
      setEnteredBack(entersAtLastStep(indexRef.current, clamped, freshRun));
      if (target && target.kind !== "slide" && target.kind !== "film" && target.kind !== "deck") {
        const cast = castOf(target.persona);
        if (cast !== lastCastRef.current) {
          lastCastRef.current = cast;
          showPersonCard(cast);
        }
      }
      indexRef.current = clamped;
      setIndex(clamped);
      if (clamped > 0) setLeftStart(true);
      if (source !== "channel") channelRef.current?.postMessage({ type: "goto", index: clamped, ...(freshRun ? { fresh: true } : {}) } satisfies StageMessage);
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
  // the last one seen. On load the stage picks up the show where the store has it, so a
  // reloaded or second stage tab never sends everyone back to the opening; with no record
  // yet it claims the record for its own beat.
  // Polls on lib/demo/stage-poll.ts's schedule: fast while the skit moves, slow when quiet, never when hidden.
  useEffect(() => {
    let stopped = false;
    let poll: StagePoll | undefined;
    const start = async () => {
      const stored = await readPosition();
      runRef.current = stored?.run ?? null;
      // Remote moves made before this stage opened are already part of where the show is.
      controlSeenRef.current = stored?.control?.seq ?? 0;
      clearClientDemoState(stored?.run);
      if (stored && isStaleRun(stored)) setStaleNote(`This is an old run, last moved ${lastMoveLabel(stored)}.`);
      const onLoad = stageOnLoad(stored);
      if (stored && onLoad.kind === "join") {
        lastSeqRef.current = Math.max(lastSeqRef.current, stored.seq);
        // Joining the show is a beat move: never a deck step, never written back.
        if (!stopped && onLoad.index !== indexRef.current) goTo(onLoad.index, "remote", true);
        return;
      }
      const position = await writePosition(indexRef.current);
      if (position) lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
    };
    void start().then(() => {
      if (stopped) return;
      poll = startStagePoll(async () => {
        const position = await readPosition();
        // A fresh run started from the console, the remote, or another stage tab: start over here too.
        if (!stopped && position?.run && position.run !== runRef.current) {
          runRef.current = position.run;
          clearClientDemoState(position.run);
          lastSeqRef.current = Math.max(lastSeqRef.current, position.seq);
          startOverRef.current();
          return 0;
        }
        if (!stopped && position && position.seq > lastSeqRef.current) {
          lastSeqRef.current = position.seq;
          const control = position.control;
          const catchUp = catchesUpOnRemoteStep(control, controlSeenRef.current, indexRef.current);
          if (control) controlSeenRef.current = Math.max(controlSeenRef.current, control.seq);
          // Another stage tab's move is followed as a beat move; the remote and phones step a deck first.
          if (position.index !== indexRef.current) goTo(position.index, "remote", followsAsBeatMove(position.by));
          // The remote's step that another stage already put back: step this stage's deck or film too.
          else if (catchUp && control && filmRef.current) {
            if (control.to > control.from) filmRef.current.next();
            else filmRef.current.back();
          }
        }
        // What the presenter's own phone heard on their beat, mirrored into the stage's phone.
        const signal = position?.signal;
        if (!stopped && signal && signal.at !== lastSignalRef.current && position.index === indexRef.current && beatCast(BEATS[indexRef.current]) === signal.from) {
          lastSignalRef.current = signal.at;
          const phone = lastFrameRef.current?.contentWindow;
          if (signal.kind === "failed") phone?.postMessage({ source: "demo-stage", type: "failed", text: signal.text ?? "" }, window.location.origin);
          if (signal.kind === "listening") phone?.postMessage({ source: "demo-stage", type: "listening", on: signal.on === true }, window.location.origin);
          if (signal.kind === "said" && signal.text) {
            phone?.postMessage({ source: "demo-stage", type: "heard", text: signal.text }, window.location.origin);
            spokenRef.current = true;
          }
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
      const message = inFrameMessage(beat, locationRef.current, { storyEventId, now: runStartedAt });
      const phone = lastFrameRef.current?.contentWindow;
      if (!personaChanged && message && phone) {
        if (!(message.type === "demo-ask" && spokenRef.current)) phone.postMessage(message, window.location.origin);
        locationRef.current = beatSrc;
        return;
      }
      locationRef.current = beatSrc;
      spokenRef.current = false;
      zRef.current += 1;
      const z = zRef.current;
      // Loaded ahead (U1b during U1a): take over that screen in place, with the same key,
      // so React keeps its iframe instead of loading it again. A held screen gets "reveal"
      // as it appears, so Muse shows its work in view.
      const ahead = aheadPath(beat, { storyEventId, now: runStartedAt });
      const prefetched = ahead !== null && document.querySelector<HTMLIFrameElement>("iframe[data-prefetch]")?.getAttribute("src") === ahead;
      const src = prefetched ? ahead : beatSrc;
      const key = prefetched ? prefetchKey(ahead) : String(Date.now());
      const loaded = prefetched && loadedAhead.includes(ahead);
      if (prefetched && beat.prefetchPath) revealKeyRef.current = key;
      setFrames((current) => withFrameOnTop(current, { src, key, loaded }, z));
      if (loaded) frameLoaded(key);
    }
  }, [beat, beatSrc, storyEventId, runStartedAt, frameLoaded, loadedAhead]);

  // Show a new screen by the rule in lib/demo/reveal.ts: once its page is parsed and painted, its
  // load event fired, or it said it is ready, and never later than REVEAL_CEILING_MS after it was
  // put in. Until then the old screen stays up, so a cut never shows a blank frame, and a logo or
  // map tile hanging on a slow network never keeps the last screen up.
  const pendingTop = topFrame(frames);
  const pendingKey = pendingTop && !pendingTop.loaded ? pendingTop.key : null;
  useEffect(() => {
    if (!pendingKey) return;
    const startedAt = Date.now();
    const held = pendingKey === revealKeyRef.current;
    let shown = false;
    const timer = window.setInterval(() => {
      let domReady = false;
      try {
        const frame = lastFrameRef.current;
        const doc = frame?.contentDocument;
        const href = frame?.contentWindow?.location.href;
        domReady = Boolean(doc && href && href !== "about:blank" && doc.readyState !== "loading" && doc.body?.childElementCount);
      } catch {
        domReady = false;
      }
      const ready = shouldReveal({ domReady, loaded: false, screenReady: readyKeysRef.current.has(pendingKey), elapsedMs: Date.now() - startedAt, held });
      if (!ready) return;
      window.clearInterval(timer);
      shown = true;
      // Two frames for the first paint after parsing.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => frameLoaded(pendingKey)));
      // A held screen shown before its load event may miss its "reveal": say it again once the page has loaded.
      if (held) {
        const again = window.setInterval(() => {
          try {
            const frame = lastFrameRef.current;
            if (frame?.contentDocument?.readyState !== "complete") return;
            frame.contentWindow?.postMessage({ source: "demo-stage", type: "reveal" }, window.location.origin);
          } catch {
            // Not readable yet: try again.
            return;
          }
          window.clearInterval(again);
        }, 200);
        window.setTimeout(() => window.clearInterval(again), 30_000);
      }
    }, 40);
    return () => {
      if (!shown) window.clearInterval(timer);
    };
  }, [pendingKey, frameLoaded]);

  // A screen that says it is ready ({source: "demo-screen", type: "ready"}) shows at once.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== lastFrameRef.current?.contentWindow) return;
      const data = event.data as { source?: unknown; type?: unknown } | null;
      if (data?.source !== "demo-screen" || data.type !== "ready") return;
      const top = topFrame(framesRef.current);
      if (top && !top.loaded) readyKeysRef.current.add(top.key);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // A held screen taken over from loading ahead: tell it to show its work once it is on top and loaded.
  const topForReveal = topFrame(frames);
  useEffect(() => {
    if (!topForReveal || topForReveal.key !== revealKeyRef.current || !topForReveal.loaded) return;
    revealKeyRef.current = null;
    lastFrameRef.current?.contentWindow?.postMessage({ source: "demo-stage", type: "reveal" }, window.location.origin);
  }, [topForReveal]);

  // Load the next beat's screen hidden, when it asks for that and the same person plays it.
  const nextBeat = BEATS[index + 1];
  const prefetchSrc =
    nextBeat?.prefetch && beat.kind !== "slide" && beat.kind !== "film" && beat.kind !== "deck" && castOf(nextBeat.persona) === castOf(beat.persona)
      ? aheadPath(nextBeat, { storyEventId, now: runStartedAt })
      : null;


  // A staged beat's route may not be built yet: use a placeholder until it is.
  const stagedPath = beat.kind === "staged" ? beatSrc : null;
  const stagedReady = useExists(stagedPath);
  const showPlaceholder = beat.kind === "staged" && (!stagedPath || stagedReady !== true);
  // The opening: its live deck when the page is there, else its rendered film, else
  // a plain slide per section. Nothing shows until the checks answer, so it never flashes.
  const deck = beat.kind === "deck" && beat.deck ? deckPath(beat.deck) : null;
  const deckReady = useExists(deck);
  // A deck that exists plays instead of its film, so the film files are looked for only without one.
  const film = (beat.kind === "film" || beat.kind === "deck") && beat.film && (deck === null || deckReady === false) ? filmFiles(beat.film) : null;
  const filmReady = useExists(film?.video ?? null);
  const filmCues = useCues(film?.cues ?? null);
  const showDeck = deck !== null && deckReady === true;
  const playFilm = !showDeck && film !== null && filmReady === true && filmCues !== undefined;
  const opening = beat.kind === "deck" || beat.kind === "film";
  const openingChecked = (deck === null || deckReady !== undefined) && (film === null || filmReady !== undefined);
  const deckEnd = useCallback(() => goTo(indexRef.current + 1, "local", true), [goTo]);
  const deckStart = useCallback(() => goTo(indexRef.current - 1, "local", true), [goTo]);

  // Back to the first beat of a new run: a fresh clock, no screens, no story event yet.
  const startOver = useCallback(() => {
    setRunStartedAt(demoClock());
    personaRef.current = undefined;
    locationRef.current = null;
    lastCastRef.current = null;
    spokenRef.current = false;
    lastSignalRef.current = null;
    setFrames([]);
    setLoadedAhead([]);
    setHandedOffTo(null);
    setStoryEventId(null);
    setLeftStart(false);
    setStaleNote(null);
    setConfirmFresh(false);
    setRunCount((count) => count + 1);
    goTo(0, "local", true, true);
  }, [goTo]);
  useEffect(() => {
    startOverRef.current = startOver;
  }, [startOver]);

  // The fresh run (Shift+R, or the quiet control on the first beat), with this browser's token.
  const resetDemo = useCallback(async () => {
    setStatus("Starting a fresh run");
    const result = await requestFreshRun();
    if (!result.ok) {
      setStatus(result.needsToken ? `${result.message} Enter the token once on /demo/console.` : result.message);
      return;
    }
    if (result.run) runRef.current = result.run;
    clearClientDemoState(result.run ?? undefined);
    startOver();
    setStatus("Fresh run: nothing from earlier runs is left");
  }, [startOver]);

  useEffect(() => {
    if (!status || status === "Starting a fresh run") return;
    const timer = setTimeout(() => setStatus(null), 6_000);
    return () => clearTimeout(timer);
  }, [status]);

  // Presenter windows on the same browser stay in step.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (message: MessageEvent<StageMessage>) => {
      if (message.data.type === "goto") {
        // Another stage tab in this browser moved: follow it as a beat move (a fresh run lands on the first step).
        goTo(message.data.index, "channel", true, message.data.fresh === true);
      }
      if (message.data.type === "reset") void resetDemo();
    };
    return () => channel.close();
  }, [goTo, resetDemo]);

  // A staged screen's last tap: the phone is already on the next path, so move on without reloading it.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: unknown; type?: unknown; path?: unknown } | null;
      // A screen passes the show to the next person (Lisa's "Open to company", Jolyn's "Sent to Lisa").
      if (data?.source === "demo-screen" && data.type === "said") spokenRef.current = true;
      if (data?.source === "demo-screen" && data.type === "pass") {
        const start = nextActStart(index);
        if (start !== null) goTo(start);
        return;
      }
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
  const ownAhead = beat.prefetch && beatSrc && handedOffTo !== beatSrc ? aheadPath(beat, { storyEventId, now: runStartedAt }) : null;
  const aheadSrcs = [prefetchSrc, ownAhead].filter(
    (src): src is string => src !== null && !frames.some((frame) => frame.src === src || frame.key === prefetchKey(src)),
  );
  const shownFrames: Frame[] = [...frames, ...aheadSrcs.map((src) => ({ src, key: prefetchKey(src), loaded: false, z: 0, prefetch: true }))];

  return (
    // The opening is near-black like its decks (#08090D), with nothing over it; the skit is Facebook's white page.
    <div className={`fixed inset-0 z-[100] flex flex-col overflow-clip ${opening ? "bg-[#08090d] text-white" : "bg-page text-ink"}`}>
      {opening && !showDeck && !playFilm && beat.sections ? (
        openingChecked ? (
          <SectionSlides key={`${beat.id}-${enteredBack}-${runCount}`} lines={beat.sections.map((section) => section.line)} startAtEnd={enteredBack} controls={filmRef} />
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
          <PhoneFrame scale={scale} chrome={phoneChromeFor(beat, showPlaceholder && stagedReady === false)} time={runStartedAt}>
            <div className="absolute inset-0">
              {/* The placeholder only once the staged route is known to be missing, so the cut into a staged beat never flashes it. */}
              {showPlaceholder && stagedReady === false && beat.staged ? (
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
          </PhoneFrame>
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
          key={`${deck}-${enteredBack}-${runCount}`}
          src={deck}
          startAtEnd={enteredBack}
          controls={filmRef}
          onEnd={deckEnd}
          onStart={deckStart}
          onStep={(step, steps) => {
            channelRef.current?.postMessage({ type: "deck-step", beatId: beat.id, step } satisfies StageMessage);
            if (beat.deck) writeDeckStep(index, beat.deck, step, steps);
          }}
        />}
      {playFilm && film && filmCues && <FilmPlayer key={film.video} src={film.video} cues={filmCues} controls={filmRef} />}

      {personCard && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[24px] bg-page motion-safe:animate-[stage-card_var(--card-ms)_linear_both]"
          style={{ ["--card-ms" as string]: `${PERSON_CARD_MS}ms` }}
        >
          <style>{`@keyframes stage-card{0%{opacity:0}${CARD_FADE_PCT}%{opacity:1}${100 - CARD_FADE_PCT}%{opacity:1}100%{opacity:0}}`}</style>
          <CastAvatar id={personCard} size={128} />
          <p className="font-display text-[clamp(28px,3.4vw,56px)] font-bold">Now: {castLine(personCard)}</p>
        </div>
      )}

      {/* The fresh run, on the first beat until the show moves on (Shift+R works anywhere). It stays
          invisible over the projected opening unless the pointer is in that corner, it is being
          confirmed, or the run is stale (then the note shows). */}
      {index === 0 && !leftStart && (
        <div
          className={`absolute right-0 bottom-0 z-30 flex items-center gap-2 p-3 text-[12px] text-white/45 transition-opacity duration-200 hover:text-white/90 hover:opacity-100 focus-within:opacity-100 ${
            staleNote || confirmFresh ? "opacity-100" : "opacity-0"
          }`}
        >
          {confirmFresh ? (
            <>
              <span>Clear every earlier run and start over?</span>
              <button type="button" onClick={() => void resetDemo()} className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white">
                Start fresh
              </button>
              <button type="button" onClick={() => setConfirmFresh(false)} className="rounded-full px-2 py-1">
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmFresh(true)} className="rounded-full px-2 py-1">
              {staleNote ? `${staleNote} Fresh run` : "Fresh run"}
            </button>
          )}
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
