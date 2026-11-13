"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useVoiceRecorder } from "@/components/ask/use-voice-recorder";
import type { CrawlEvent } from "@/components/map/crawl-planner";
import { MuseFace } from "@/components/map/muse-menu";
import { speakAsMuse, stopSpeaking } from "@/components/map/muse-voice";
import { Avatar } from "@/components/social/whos-going";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { walkMinutes } from "@/lib/geo";
import type { Point, Route, RouteStop } from "@/lib/map/crawl-route";
import { friendNamedIn, type FriendSpot } from "@/lib/map/friend-spots";
import type { AskReply, MuseRouteResponse } from "@/lib/muse/types";

// Muse on the map, as a conversation (the "free bite" alert path, /?plan=home).
// Muse plans the walk home where you can see it working, then says what it
// found in a sentence or two. The mic is the main control: tap to talk, the
// words go to Muse Voice Transcribe and then to Muse ask, and a request like
// "I'm meeting Lisa, find something for both of us and send it to her" re-plans
// the walk toward the friend, replaces the plan, and sends the invite.
// Every line is built from the real answers; every stamp is the real call.
//
// Stage contract (only when framed by the /demo stage or a phone wrapper):
//   screen to parent: {source: "demo-screen", type: "listening", on} and {source: "demo-screen", type: "said", text}
//   parent to screen: {source: "demo-stage", type: "heard", text}, {type: "listening", on}, {type: "reveal"},
//                     and the older {type: "demo-ask", line} (typed fallback).

type Source = "muse" | "fixture";
type ApiStop = Omit<RouteStop, "startsAt" | "endsAt">;
type ApiPlan = {
  stops: ApiStop[];
  destination: Route["destination"];
  totalWalkMinutes: number;
  pitch: string;
  invite: { eventId: string | null; message: string; path: string | null };
};

type Stamp = { source: Source; ms: number };
type Said = { text: string; by: "voice" | "typed"; transcribeMs?: number };
type Invite = { friend: FriendSpot; state: "sending" | "sent" | "error" };

type Phase =
  | { kind: "planning"; steps: string[]; startedAt: number }
  | { kind: "ready" }
  | { kind: "transcribing" }
  | { kind: "asking"; title: string; steps: string[]; startedAt: number }
  | { kind: "error"; message: string };

const MIN_REVEAL_MS = 3000;
const MIN_REPLAN_MS = 2400;
const STEP_MS = 850;
const MUSE_TOGGLE = "muse:toggle";
// Home for the demo student until the profile carries a dorm (the same spot the crawl planner uses).
const HOME = { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isFramed = () => typeof window !== "undefined" && window.parent !== window;

function postToParent(message: Record<string, unknown>) {
  if (isFramed()) window.parent.postMessage({ source: "demo-screen", ...message }, window.location.origin);
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

/** "Stata Center, 32-123" reads as "Stata Center". */
function shortPlace(name: string): string {
  return name.split(",")[0]!.trim();
}

function toRoute(from: Point, plan: ApiPlan, eventsById: Map<string, CrawlEvent>): Route {
  const stops: RouteStop[] = plan.stops.map((stop) => {
    const event = stop.eventId ? eventsById.get(stop.eventId) : undefined;
    return { ...stop, startsAt: event?.startIso ?? null, endsAt: event?.endIso ?? null };
  });
  return { from, stops, destination: plan.destination, totalWalkMinutes: plan.totalWalkMinutes };
}

/** "Pizza at Stata Center", or just the title when it already names the place. */
function titleAt(title: string, placeName: string): string {
  const place = shortPlace(placeName);
  const firstWord = place.split(" ")[0]!.toLowerCase();
  return title.toLowerCase().includes(firstWord) ? title : `${title} at ${place}`;
}

/** Muse's two sentences for the walk home, from the plan and the student's own day. */
function homeLine(route: Route, startLabel: string | null): string {
  const opener = startLabel ? `You're ${startLabel.charAt(0).toLowerCase()}${startLabel.slice(1)}.` : "";
  const first = route.stops[0];
  if (!first) return `${opener} Nothing free is on your way home right now.`.trim();
  const second = route.stops[1];
  const minutes = first.walkMinutes === 1 ? "a minute" : `${first.walkMinutes} minutes`;
  const rest = second ? `, then ${second.title}` : "";
  return `${opener} ${titleAt(first.title, first.placeName)} is ${minutes} away${rest}, on your way home.`.trim();
}

/** The first sentence or two of an answer, never a paragraph. */
function brief(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).length > 170 && out) break;
    out += sentence;
    if (out.length > 90) break;
  }
  return out.trim();
}

async function timed<T>(run: () => Promise<Response>): Promise<{ body: T | null; ms: number; ok: boolean }> {
  const started = performance.now();
  try {
    const response = await run();
    const body = (await response.json()) as T;
    return { body, ms: performance.now() - started, ok: response.ok };
  } catch {
    return { body: null, ms: performance.now() - started, ok: false };
  }
}

function MicGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
    </svg>
  );
}

function KeyboardGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/** Bars that move with the real microphone level while she talks (a second read of the same mic). */
function useMicLevel(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => Array(16).fill(0.08));
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const history: number[] = Array(16).fill(0.08);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 9);
          history.shift();
          history.push(Math.max(0.08, level));
          setBars([...history]);
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      setBars(Array(16).fill(0.08));
    };
  }, [active]);
  return bars;
}

export function MuseConversation({
  studentSpot,
  events,
  at,
  startLabel,
  holdReveal,
  autoAsk,
  onRoute,
  onPreviewSpot,
}: {
  studentSpot: Point;
  events: CrawlEvent[];
  /** When the walk starts (ISO), the demo clock (?time=); now when null. */
  at: string | null;
  /** "Out of Calculus II": the class she just left. */
  startLabel: string | null;
  /** Wait for the stage's {type: "reveal"} before showing the plan (loaded ahead, hidden). */
  holdReveal: boolean;
  /** A request typed in on arrival (?auto=1), the laptop-only fallback. */
  autoAsk: string | null;
  onRoute: (route: Route | null) => void;
  /** A friend's spot to show on the map while Muse plans toward them. */
  onPreviewSpot: (spot: FriendSpot | null) => void;
}) {
  const eventsById = useMemo(() => new Map(events.map((event) => [event.eventId, event])), [events]);
  const [phase, setPhase] = useState<Phase>({ kind: "planning", steps: [], startedAt: 0 });
  const [line, setLine] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [heading, setHeading] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [mirrorListening, setMirrorListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const revealRef = useRef<{ released: boolean; resolve: (() => void) | null }>({ released: !holdReveal, resolve: null });
  const busyRef = useRef(false);
  const cardRef = useRef<HTMLElement>(null);

  const [startMs] = useState(() => (at && Number.isFinite(Date.parse(at)) ? Date.parse(at) : Date.now()));

  const released = useCallback(
    () =>
      revealRef.current.released
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            revealRef.current.resolve = resolve;
          }),
    [],
  );

  const show = useCallback(
    (next: Route | null) => {
      setRoute(next);
      onRoute(next);
    },
    [onRoute],
  );

  const say = useCallback((text: string) => {
    setLine(text);
    speakAsMuse(text);
  }, []);

  // The walk home, planned as the screen opens, revealed where you can see Muse work.
  const planned = useRef(false);
  useEffect(() => {
    if (planned.current) return;
    planned.current = true;
    void (async () => {
      const steps = [startLabel ?? "Where you are now", "Free food on your way home", "Asking Muse for the best stop"];
      const call = timed<MuseRouteResponse<ApiPlan>>(() =>
        fetch("/api/muse/crawl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: studentSpot, to: { lat: HOME.lat, lng: HOME.lng }, toLabel: HOME.name, mode: "walk", at: new Date(startMs).toISOString(), exclude: [] }),
        }),
      );
      await released();
      const revealStart = Date.now();
      setPhase({ kind: "planning", steps: [], startedAt: revealStart });
      for (let index = 0; index < steps.length; index += 1) {
        setPhase({ kind: "planning", steps: steps.slice(0, index + 1), startedAt: revealStart });
        await wait(STEP_MS);
      }
      const result = await call;
      await wait(Math.max(0, MIN_REVEAL_MS - (Date.now() - revealStart)));
      if (!result.body?.data) {
        setPhase({ kind: "error", message: "Muse could not plan the walk right now. Ask again." });
        return;
      }
      const next = toRoute(studentSpot, result.body.data, eventsById);
      show(next);
      setStamp({ source: result.body.source ?? "muse", ms: result.ms });
      setHeading(next.stops[0] ? `${next.stops[0].title} on your way home` : "Your walk home");
      setPhase({ kind: "ready" });
      say(homeLine(next, startLabel));
    })();
    // Planned once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A request, spoken or typed: Muse ask, then the re-plan toward a friend, then the invite.
  const ask = useCallback(
    async (text: string, by: Said["by"], transcribeMs?: number) => {
      const question = text.trim();
      if (!question || busyRef.current) return;
      busyRef.current = true;
      stopSpeaking();
      setSaid({ text: question, by, transcribeMs });
      postToParent({ type: "said", text: question });
      const friend = friendNamedIn(question);
      const title = friend ? `Finding something between you and ${friend.name}` : "Muse is on it";
      const askStarted = Date.now();
      setPhase({ kind: "asking", title, steps: [], startedAt: askStarted });
      if (friend) onPreviewSpot(friend);
      const askCall = timed<MuseRouteResponse<AskReply>>(() =>
        fetch("/api/muse/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, fresh: true }) }),
      );
      setPhase({ kind: "asking", title, steps: friend ? [`${friend.name} is at ${friend.placeName}`] : [], startedAt: askStarted });
      const asked = await askCall;
      const reply = asked.body?.data ?? null;
      if (!reply) {
        busyRef.current = false;
        onPreviewSpot(null);
        setPhase({ kind: "error", message: "Muse couldn't answer right now. Try again." });
        return;
      }
      if (!reply.plan || !friend) {
        // Not a re-plan: Muse just answers, briefly.
        await wait(Math.max(0, 900 - (Date.now() - askStarted)));
        busyRef.current = false;
        onPreviewSpot(null);
        setStamp({ source: asked.body?.source ?? "muse", ms: asked.ms });
        setPhase({ kind: "ready" });
        say(brief(reply.answer));
        return;
      }
      setPhase({ kind: "asking", title, steps: [`${friend.name} is at ${friend.placeName}`, "Asking Muse for a stop that suits you both"], startedAt: askStarted });
      const pickedId = reply.plan.eventId ?? reply.eventIds[0] ?? null;
      // Muse's own pick leads only when it really sits between the two of them; otherwise the
      // walk goes to the friend and the planner picks the stop on the way.
      const candidate = pickedId ? eventsById.get(pickedId) : undefined;
      const between = (spot: Point) => walkMinutes(studentSpot, spot) + walkMinutes(spot, friend) <= walkMinutes(studentSpot, friend) * 1.6 + 3;
      const picked = candidate && between(candidate.place) ? candidate : undefined;
      const planned = await timed<MuseRouteResponse<ApiPlan>>(() =>
        fetch("/api/muse/crawl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            from: studentSpot,
            // Muse named the stop: the walk ends there (Lisa meets you at it); otherwise at Lisa.
            to: picked ? { lat: picked.place.lat, lng: picked.place.lng } : { lat: friend.lat, lng: friend.lng },
            toLabel: picked ? picked.place.name : `${friend.name} at ${friend.placeName}`,
            note: picked ? `${question} (${picked.title} at ${picked.place.name})` : question,
            mode: "walk",
            at: new Date(startMs).toISOString(),
            exclude: [],
          }),
        }),
      );
      await wait(Math.max(0, MIN_REPLAN_MS - (Date.now() - askStarted)));
      busyRef.current = false;
      const data = planned.body?.data;
      if (!data) {
        onPreviewSpot(null);
        setPhase({ kind: "error", message: `Muse could not plan a walk to ${friend.name}. Try again.` });
        return;
      }
      const next = toRoute(studentSpot, data, eventsById);
      onPreviewSpot(null);
      show(next);
      setStopsOpen(false);
      const stopId = picked?.eventId ?? data.invite.eventId ?? next.stops.find((stop) => stop.eventId)?.eventId ?? null;
      const stop: { title: string; placeName: string; lat: number; lng: number } | null = picked
        ? { title: picked.title, placeName: picked.place.name, lat: picked.place.lat, lng: picked.place.lng }
        : (next.stops.find((candidate) => candidate.eventId === stopId) ?? next.stops[0] ?? null);
      const live = asked.body?.source !== "fixture" && planned.body?.source !== "fixture";
      setStamp({ source: live ? "muse" : "fixture", ms: asked.ms + planned.ms });
      setHeading(stop ? `${stop.title} with ${friend.name}` : `Your walk to ${friend.name}`);
      setPhase({ kind: "ready" });
      if (stop) {
        const mine = walkMinutes(studentSpot, stop);
        const theirs = walkMinutes(friend, stop);
        say(`${titleAt(stop.title, stop.placeName)}: ${mine} min for you, ${theirs} for ${friend.name}. I'm sending ${friend.name} the invite.`);
      } else {
        say(brief(data.pitch));
      }
      if (stopId) {
        setInvite({ friend, state: "sending" });
        const sent = await fetch("/api/social/invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: friend.id, eventId: stopId, message: data.invite.message }),
        }).catch(() => null);
        setInvite({ friend, state: sent?.ok ? "sent" : "error" });
      }
    },
    [eventsById, onPreviewSpot, say, show, startMs, studentSpot],
  );

  // Voice: the recorder, end of speech detection, and transcribe, as Ask Muse uses them.
  const onClip = useCallback(
    async (wav: Blob) => {
      setPhase({ kind: "transcribing" });
      const form = new FormData();
      form.append("audio", wav, "question.wav");
      const result = await timed<MuseRouteResponse<{ transcript: string }>>(() => fetch("/api/muse/transcribe", { method: "POST", body: form }));
      const transcript = result.body?.data?.transcript?.trim() ?? "";
      if (!transcript) {
        setPhase({ kind: "ready" });
        setVoiceNote("Didn't catch that. Tap the mic and try again, or type it.");
        return;
      }
      await ask(transcript, "voice", result.ms);
    },
    [ask],
  );
  const recorder = useVoiceRecorder(onClip, () => {
    setPhase({ kind: "ready" });
    setVoiceNote("Didn't hear anything. Tap the mic to try again.");
  });
  const listening = recorder.recording || mirrorListening;
  const bars = useMicLevel(recorder.recording);

  useEffect(() => {
    postToParent({ type: "listening", on: recorder.recording });
  }, [recorder.recording]);

  const toggleMic = useCallback(() => {
    if (recorder.recording) return recorder.stop();
    if (busyRef.current) return;
    stopSpeaking();
    setVoiceNote(null);
    setTyping(false);
    void recorder.start({ autoStop: true });
  }, [recorder]);

  // The stage and the phones: heard words, a mirrored listening state, the reveal.
  useEffect(() => {
    if (!isFramed()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { source?: unknown; type?: unknown; text?: unknown; on?: unknown; line?: unknown } | null;
      if (!data) return;
      if (data.type === "reveal") {
        revealRef.current.released = true;
        revealRef.current.resolve?.();
      } else if (data.source === "demo-stage" && data.type === "listening" && typeof data.on === "boolean") {
        setMirrorListening(data.on);
      } else if (data.source === "demo-stage" && data.type === "heard" && typeof data.text === "string") {
        setMirrorListening(false);
        void ask(data.text, "voice");
      } else if (data.type === "demo-ask" && typeof data.line === "string") {
        void ask(data.line, "typed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ask]);

  // ?auto=1 on the laptop: type the request in once the walk is up.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!autoAsk || autoAsked.current || phase.kind !== "ready" || !route) return;
    autoAsked.current = true;
    const timer = setTimeout(() => void ask(autoAsk, "typed"), 1500);
    return () => clearTimeout(timer);
  }, [autoAsk, phase.kind, route, ask]);

  // The Muse button at the top right opens this conversation, in every state.
  useEffect(() => {
    const onToggle = () => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      cardRef.current?.querySelector<HTMLButtonElement>("[data-muse-mic]")?.focus();
      cardRef.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.015)" }, { transform: "scale(1)" }], { duration: 320 });
    };
    window.addEventListener(MUSE_TOGGLE, onToggle);
    return () => window.removeEventListener(MUSE_TOGGLE, onToggle);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  function submitTyped(formEvent: FormEvent) {
    formEvent.preventDefault();
    const text = typed;
    setTyped("");
    setTyping(false);
    void ask(text, "typed");
  }

  const working = phase.kind === "planning" || phase.kind === "asking" || phase.kind === "transcribing";
  const statusLine =
    phase.kind === "planning"
      ? "Muse is planning your walk home"
      : phase.kind === "asking"
        ? phase.title
        : phase.kind === "transcribing"
          ? "Muse is reading what you said"
          : listening
            ? "Listening"
            : null;
  const steps = phase.kind === "planning" || phase.kind === "asking" ? phase.steps : [];

  return (
    <section
      ref={cardRef}
      aria-label="Muse"
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(66%,520px)] flex-col rounded-t-[20px] bg-card pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+10px)] shadow-[0_-6px_24px_rgba(0,0,0,0.14)]"
    >
      <style>{CONVERSATION_CSS}</style>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        {said && (
          <div className="mc-rise mb-[10px] flex flex-col items-end">
            <p className="max-w-[88%] rounded-[18px] rounded-br-[6px] bg-primary px-[12px] py-[8px] text-body font-medium text-on-primary">{said.text}</p>
            <p className="mt-[3px] flex items-center gap-[4px] text-meta text-muted">
              {said.by === "voice" ? <MicGlyph className="h-[11px] w-[11px]" /> : <KeyboardGlyph className="h-[12px] w-[12px]" />}
              {said.by === "voice" ? (said.transcribeMs ? `Said · transcribed by Muse in ${(said.transcribeMs / 1000).toFixed(1)} s` : "Said") : "Typed"}
            </p>
          </div>
        )}

        <div className="flex items-start gap-[10px]">
          <span className={`relative mt-[1px] shrink-0 rounded-full ${working ? "mc-working" : ""}`}>
            <MuseFace size={38} />
          </span>
          <div className="min-w-0 flex-1" aria-live="polite">
            {statusLine ? (
              <>
                <p className="font-display text-label font-bold leading-[19px]">{statusLine}</p>
                {steps.length > 0 && (
                  <ul className="mt-[6px] flex flex-col gap-[4px]">
                    {steps.map((step, index) => {
                      const last = index === steps.length - 1;
                      return (
                        <li key={step} className="mc-rise flex items-center gap-[7px] text-venue font-medium text-muted">
                          <span className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ${last ? "mc-pulse bg-primary-soft" : "bg-primary text-on-primary"}`}>
                            {!last && <CheckGlyph className="h-[9px] w-[9px]" />}
                          </span>
                          {step}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : phase.kind === "error" ? (
              <p className="text-body font-medium">{phase.message}</p>
            ) : (
              line && (
                <>
                  <p key={line} className="mc-rise text-[15px] leading-[20px] font-medium text-ink">
                    {line}
                  </p>
                  {stamp && (
                    <p className="mt-[4px] text-meta font-semibold text-muted">
                      {stamp.source === "muse" ? `Answered by Muse · live, ${(stamp.ms / 1000).toFixed(1)} s` : "Recorded answer"}
                    </p>
                  )}
                </>
              )
            )}
          </div>
        </div>

        {invite && phase.kind === "ready" && (
          <div className="mc-rise mt-[10px] flex items-center gap-[10px] rounded-[12px] bg-primary-soft px-[10px] py-[8px]">
            <Avatar person={{ id: invite.friend.id, name: invite.friend.name }} size={30} />
            <p className="min-w-0 flex-1 font-display text-label font-bold text-link">
              {invite.state === "sent" ? `Invite sent to ${invite.friend.name}` : invite.state === "sending" ? `Sending ${invite.friend.name} the invite` : `Couldn't send ${invite.friend.name} the invite`}
            </p>
            {invite.state === "sent" && (
              <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-primary text-on-primary">
                <CheckGlyph className="h-[12px] w-[12px]" />
              </span>
            )}
          </div>
        )}

        {route && phase.kind === "ready" && heading && (
          <div className="mt-[10px] rounded-[12px] border border-hairline">
            <button
              type="button"
              onClick={() => setStopsOpen((open) => !open)}
              aria-expanded={stopsOpen}
              className="flex w-full items-center gap-[8px] px-[12px] py-[9px] text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-label font-bold">{heading}</span>
                <span className="block text-meta font-semibold text-muted">
                  {route.stops.length} {route.stops.length === 1 ? "stop" : "stops"} · {route.totalWalkMinutes} min walk · {shortPlace(route.destination.name)} by {clock(route.destination.arriveAt)}
                </span>
              </span>
              <svg viewBox="0 0 24 24" className={`h-[16px] w-[16px] text-muted transition-transform duration-200 ${stopsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${stopsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <ol className="min-h-0 overflow-hidden">
                {route.stops.map((stop, index) => (
                  <li key={`${stop.title}-${index}`} className="flex items-center gap-[10px] border-t border-hairline px-[12px] py-[7px]">
                    <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#1f7a3f] font-display text-[11px] font-bold text-white">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label font-semibold">{stop.title}</span>
                      <span className="block truncate text-meta text-muted">
                        {stop.walkMinutes} min walk · arrive {clock(stop.arriveAt)} · {shortPlace(stop.placeName)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pt-[10px]">
        {typing ? (
          <form onSubmit={submitTyped} className="flex items-center gap-[8px]">
            <input
              autoFocus
              value={typed}
              onChange={(change) => setTyped(change.target.value)}
              placeholder="Type to Muse"
              aria-label="Type to Muse"
              className="h-[44px] min-w-0 flex-1 rounded-full bg-wash px-[14px] text-body outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button type="submit" disabled={!typed.trim()} className="h-[44px] rounded-full bg-primary px-[16px] font-display text-label font-bold text-on-primary disabled:opacity-50">
              Send
            </button>
            <button type="button" onClick={() => setTyping(false)} aria-label="Talk instead" className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-button text-ink">
              <MicGlyph className="h-[20px] w-[20px]" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-[12px]">
            <button
              type="button"
              data-muse-mic
              onClick={toggleMic}
              disabled={working && !recorder.recording}
              aria-label={recorder.recording ? "Stop listening" : "Talk to Muse"}
              aria-pressed={listening}
              className={`relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full text-on-primary transition-colors duration-200 disabled:opacity-60 ${listening ? "bg-[#e41e3f]" : "bg-primary"}`}
            >
              {listening && <span aria-hidden className="mc-ring absolute inset-0 rounded-full" />}
              <MicGlyph className="h-[26px] w-[26px]" />
            </button>
            <div className="min-w-0 flex-1">
              {listening ? (
                <div className="flex h-[34px] items-center gap-[3px]" aria-label="Listening">
                  {(recorder.recording ? bars : Array(16).fill(0.08)).map((level, index) => (
                    <span
                      key={index}
                      className={`w-[4px] rounded-full bg-[#e41e3f] ${recorder.recording ? "" : "mc-idle-bar"}`}
                      style={{ height: `${Math.round(6 + level * 28)}px`, animationDelay: `${index * 70}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <p className="font-display text-label font-bold">{phase.kind === "transcribing" ? "Got it" : "Tap to talk to Muse"}</p>
                  <p className="text-meta text-muted">{voiceNote ?? recorder.error ?? "It hears when you're done."}</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                recorder.cancel();
                setTyping(true);
              }}
              disabled={working}
              className="flex h-[40px] items-center gap-[6px] rounded-full bg-button px-[12px] font-display text-meta font-bold text-ink disabled:opacity-50"
            >
              <KeyboardGlyph className="h-[16px] w-[16px]" />
              Type
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const CONVERSATION_CSS = `
@keyframes mc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mc-ring { 0% { box-shadow: 0 0 0 0 rgba(228,30,63,.45); } 100% { box-shadow: 0 0 0 16px rgba(228,30,63,0); } }
@keyframes mc-working { 0%,100% { box-shadow: 0 0 0 0 rgba(8,102,255,.35); transform: scale(1); } 50% { box-shadow: 0 0 0 7px rgba(8,102,255,0); transform: scale(1.06); } }
@keyframes mc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes mc-idle { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(2.4); } }
.mc-rise { animation: mc-rise 320ms cubic-bezier(.3,.7,.3,1) both; }
.mc-ring { animation: mc-ring 1.1s ease-out infinite; }
.mc-working { animation: mc-working 1.3s ease-in-out infinite; }
.mc-pulse { animation: mc-pulse 1s ease-in-out infinite; }
.mc-idle-bar { animation: mc-idle .9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .mc-rise, .mc-ring, .mc-working, .mc-pulse, .mc-idle-bar { animation: none; }
}
`;
