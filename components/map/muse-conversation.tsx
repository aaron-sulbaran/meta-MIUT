"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVoiceRecorder } from "@/components/ask/use-voice-recorder";
import type { CrawlEvent } from "@/components/map/crawl-planner";
import {
  CLEAR_TABBAR,
  CrawlActions,
  EndRow,
  HOME_PATH,
  PERSON_PATH,
  SHEET_CLASS,
  SheetClose,
  SheetHandle,
  StartRow,
  StopNumber,
  StopRow,
  clock,
  routeSummary,
} from "@/components/map/crawl-sheet";
import { MuseFace } from "@/components/map/muse-menu";
import { speakAsMuse, stopSpeaking } from "@/components/map/muse-voice";
import { MetaAiMark } from "@/components/ui/meta-ai-mark";
import { USER3_CONNECTORS } from "@/lib/curate/connectors";
import { HANDOFF, handOff } from "@/lib/demo/staged";
import { walkMinutes } from "@/lib/geo";
import {
  arrivesTooLate,
  googleDirectionsUrl,
  retime,
  type Point,
  type TravelMode,
  type Route,
  type RouteStop,
} from "@/lib/map/crawl-route";
import { friendNamedIn, type FriendSpot } from "@/lib/map/friend-spots";
import { WALK_HOME } from "@/lib/demo/walk-home";
import type { AskReply, MuseRouteResponse } from "@/lib/muse/types";

// The Muse card on the map, as one conversation that never unmounts (hub
// kb/design-spec-muse-crawl and kb/design-spec-muse-voice). It opens on the
// "free bite" alert path (/?plan=home): Muse finds free food on the way home
// where you can see it, then says one sentence about it. The mic is the main
// control: tap to talk, tap again to send (end of speech also sends when it
// hears it first); the clip goes to Muse Voice Transcribe, her words show as
// a bubble, Muse ask re-plans toward a friend she names, the plan is replaced
// and the invite sent. Every sentence comes from the real answers; every stamp
// from the real call's source and time.
//
// Stage contract (only when framed by the /demo stage or a phone wrapper):
//   screen to parent: {source: "demo-screen", type: "listening", on}, {source: "demo-screen", type: "said", text},
//                     {source: "demo-screen", type: "failed", text} (hearing failed; the line shown),
//                     and {source: "demo-screen", type: "pass"} (the Sent chip passes the show to the friend)
//   parent to screen: {source: "demo-stage", type: "heard", text}, {type: "listening", on}, {type: "failed", text}, {type: "reveal"},
//                     and the older {type: "demo-ask", line} (typed).

type Source = "muse" | "fixture";
type ApiStop = Omit<RouteStop, "startsAt" | "endsAt">;
type ApiPlan = {
  stops: ApiStop[];
  destination: Route["destination"];
  totalWalkMinutes: number;
  pitch: string;
  invite: { eventId: string | null; message: string; path: string | null };
};

type Said = { text: string; by: "voice" | "typed" };
// eventId and message let a failed send be tried again from the sheet's invite button.
type Invite = { friend: FriendSpot; state: "sending" | "sent" | "error"; eventId?: string; message?: string };
// What the card shows after a request, kept for the run on the demo stage (lib/demo/said.ts):
// the stage's frame and the presenter's phone restore it instead of asking again.
type SaidView = {
  route: Route | null;
  legs: Legs | null;
  meet: { friend: FriendSpot; title: string } | null;
  friendEnd: FriendSpot | null;
  invite: Invite | null;
  line: string | null;
};
type SaidRecord = { text: string; by: Said["by"]; view: SaidView };
// The real calls behind the sentence on screen, for the stamp.
type Legs = {
  source: Source;
  transcribeMs?: number;
  askMs?: number;
  planMs: number;
  museSuggested?: string;
  /** The first-visit curate call (opening "curate"). */
  curateMs?: number;
};

// The first-visit opening (opening "curate"): Muse's top events from what she already follows.
type Pick = { eventId: string; title: string; placeName: string; reason: string };
type CurateApi = {
  data: { summary: string; picks: { event: { id: string; title: string; place: { name: string } }; reason: string }[] } | null;
  source?: Source;
  museMs?: number | null;
};
// How long each source line shows while the curate call runs, so people can read it.
const SOURCE_STEP_MS = 820;

type Phase =
  | { kind: "working"; line: string; startedAt: number }
  | { kind: "ready" }
  | { kind: "transcribing" }
  | { kind: "failed"; line: string; retry: (() => void) | null };

const MIN_REVEAL_MS = 3000;
const MIN_REPLAN_MS = 2400;
const SLOW_MS = 10_000;
const STOP_STAGGER_MS = 120;
// Walk or transit: a freebie crawl is on foot, so there is no Drive (the planner's chips).
const MODES: { id: TravelMode; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "transit", label: "Transit" },
];
const MUSE_TOGGLE = "muse:toggle";
const MUSE_STATE = "muse:state";
// Tells the alert nudge to stay away while the card is up (components/demo/nearby-watcher-gate.tsx).
export const MUSE_CARD = "muse:card";
// Home for the demo student (lib/demo/walk-home.ts, so the stage's head start asks the same walk).
const HOME = WALK_HOME;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The run's kept request (demo frames only). Words the presenter's phone heard wait this
// long for the phone's answer to be kept before this screen asks them itself.
const SAID_URL = "/api/demo/said";
const HEARD_WAIT_MS = 30_000;

async function readKeptSaid(): Promise<SaidRecord | null> {
  if (!isFramed()) return null;
  try {
    const response = await fetch(SAID_URL, { cache: "no-store" });
    const body = (await response.json()) as { data: SaidRecord | null };
    const kept = body.data;
    return kept && typeof kept.text === "string" && kept.view ? kept : null;
  } catch {
    return null;
  }
}

function keepSaid(record: SaidRecord) {
  if (!isFramed()) return;
  void fetch(SAID_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => {});
}
const isFramed = () =>
  typeof window !== "undefined" && window.parent !== window;

function postToParent(message: Record<string, unknown>) {
  if (isFramed())
    window.parent.postMessage(
      { source: "demo-screen", ...message },
      window.location.origin,
    );
}

/** In a demo frame, the "Sent to" chip passes the show to the next person's act. */
function handOverToFriend() {
  postToParent({ type: "pass" });
}

/** "Stata Center, 32-123" reads as "Stata Center". */
function shortPlace(name: string): string {
  return name.split(",")[0]!.trim();
}

/** Muse's stops, minus any that would end before she gets there. */
function toRoute(
  from: Point,
  plan: ApiPlan,
  eventsById: Map<string, CrawlEvent>,
): Route {
  const stops: RouteStop[] = plan.stops
    .map((stop) => {
      const event = stop.eventId ? eventsById.get(stop.eventId) : undefined;
      return {
        ...stop,
        startsAt: event?.startIso ?? null,
        endsAt: event?.endIso ?? null,
      };
    })
    .filter((stop) => !arrivesTooLate(stop));
  return {
    from,
    stops,
    destination: plan.destination,
    totalWalkMinutes: plan.totalWalkMinutes,
  };
}

/** Leading with the promised stop can push a later one past its end: drop it, never show Muse's plan as late. */
function dropLate(route: Route, startMs: number): Route {
  const kept = route.stops.filter((stop) => !arrivesTooLate(stop));
  return kept.length === route.stops.length
    ? route
    : retime({ ...route, stops: kept }, startMs);
}

/** The alert's promised stop leads the walk: moved to the front, or added first when Muse left it out. */
function leadWith(
  route: Route,
  event: CrawlEvent | undefined,
  startMs: number,
): Route {
  if (!event) return route;
  const found = route.stops.find((stop) => stop.eventId === event.eventId);
  const lead: RouteStop = found ?? {
    eventId: event.eventId,
    title: event.title,
    kind: "event",
    placeName: event.place.name,
    lat: event.place.lat,
    lng: event.place.lng,
    startsAt: event.startIso,
    endsAt: event.endIso,
    arriveAt: new Date(startMs).toISOString(),
    walkMinutes: 0,
    mode: "walk",
  };
  if (route.stops[0] === lead) return route;
  return retime(
    { ...route, stops: [lead, ...route.stops.filter((stop) => stop !== lead)] },
    startMs,
  );
}

const minutesAway = (minutes: number) =>
  minutes <= 1 ? "a minute away" : `${minutes} minutes away`;

/** One sentence, first person, for the walk home: one stop and one reason. */
function homeLine(route: Route): string {
  const first = route.stops[0];
  if (!first) return "Nothing free is on your way home right now.";
  return `I found ${first.title}, ${minutesAway(first.walkMinutes)} on your way home.`;
}

/** The first sentence of an answer, never a paragraph. */
function brief(text: string): string {
  const first = text.match(/[^.!?]+[.!?]+/)?.[0] ?? text;
  return first.trim();
}

async function timed<T>(
  run: () => Promise<Response>,
): Promise<{ body: T | null; ms: number }> {
  const started = performance.now();
  try {
    const response = await run();
    return {
      body: (await response.json()) as T,
      ms: performance.now() - started,
    };
  } catch {
    return { body: null, ms: performance.now() - started };
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function MicGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
    </svg>
  );
}

function KeyboardGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </svg>
  );
}

function SendGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" />
    </svg>
  );
}

/** A level bar that moves with the real microphone while she talks (a second read of the same mic). */
function useMicLevel(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => Array(18).fill(0.06));
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
        const history: number[] = Array(18).fill(0.06);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          history.shift();
          history.push(
            Math.max(0.06, Math.min(1, Math.sqrt(sum / samples.length) * 9)),
          );
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
      setBars(Array(18).fill(0.06));
    };
  }, [active]);
  return bars;
}

/** A stop row still coming, in the sheet's row geometry, while Muse works. */
function Placeholder({ index }: { index: number }) {
  return (
    <li className="flex h-[51px] items-center gap-3 border-t border-hairline" aria-hidden>
      <span className="h-6 w-6 shrink-0 rounded-full bg-wash" />
      <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <span
          className="mc-wait block h-[11px] rounded-full bg-wash"
          style={{
            width: `${62 - index * 9}%`,
            animationDelay: `${index * 180}ms`,
          }}
        />
        <span
          className="mc-wait block h-[9px] rounded-full bg-wash"
          style={{
            width: `${38 - index * 4}%`,
            animationDelay: `${index * 180 + 90}ms`,
          }}
        />
      </span>
    </li>
  );
}

export function MuseConversation({
  studentSpot,
  events,
  at,
  holdReveal,
  autoAsk,
  promisedStopId,
  storyEventId,
  onRoute,
  onPreviewSpot,
  opening = "home",
  onPicks,
}: {
  studentSpot: Point;
  events: CrawlEvent[];
  /** When the walk starts (ISO), the demo clock (?time=); now when null. */
  at: string | null;
  /** "Out of Calculus II": the class she just left (kept for the card's next pass; the spec keeps the line to one stop). */
  startLabel?: string | null;
  /** Wait for the stage's {type: "reveal"} before showing the plan (loaded ahead, hidden). */
  holdReveal: boolean;
  /** A request typed in on arrival (?auto=1), the laptop-only fallback. */
  autoAsk: string | null;
  /** The stop the class-ended alert promised: it leads the walk home. */
  promisedStopId: string | null;
  /** The event the demo follows: a friend re-plan lands on it, flagged when Muse picked another. */
  storyEventId: string | null;
  onRoute: (route: Route | null) => void;
  /** A friend's spot to show on the map while Muse plans toward them. */
  onPreviewSpot: (spot: FriendSpot | null) => void;
  /**
   * What Muse does as the card opens: "home" plans the walk home (the alert path);
   * "curate" is a first visit to Events (?first=1): Muse reads what she already
   * follows (/api/curate, seeded sources) and lists her top events on the map.
   */
  opening?: "home" | "curate";
  /** The curate opening's picks, best first, for the map to number. */
  onPicks?: (eventIds: string[]) => void;
}) {
  const router = useRouter();
  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.eventId, event])),
    [events],
  );
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<Phase>({
    kind: "working",
    line:
      opening === "curate"
        ? USER3_CONNECTORS[0]!.reading
        : "Finding free food on your way home",
    startedAt: 0,
  });
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [legs, setLegs] = useState<Legs | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeKey, setRouteKey] = useState(0);
  const [friendEnd, setFriendEnd] = useState<FriendSpot | null>(null);
  // A re-plan to one event: the friend meets you there.
  const [meet, setMeet] = useState<{
    friend: FriendSpot;
    title: string;
  } | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  // The walk home's own invite, for "Send to a friend" before any friend is named.
  const [shareInvite, setShareInvite] = useState<ApiPlan["invite"] | null>(null);
  const [shared, setShared] = useState(false);
  const [typing, setTyping] = useState(false);
  // Walk or Transit, the planner's chips: same stops, new travel times. A new plan starts on Walk.
  const [mode, setMode] = useState<TravelMode>("walk");
  // The scrolling part of the card, and Muse's newest line in it (kept in view).
  const scrollRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [mirrorListening, setMirrorListening] = useState(false);
  const [slow, setSlow] = useState(false);
  const revealRef = useRef<{ released: boolean; resolve: (() => void) | null }>(
    { released: !holdReveal, resolve: null },
  );
  const busyRef = useRef(false);
  // The kept request on screen (its words), and whether it replaced the walk home on open.
  const shownSaidRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  const routeRef = useRef<Route | null>(null);
  // Retries call the latest version of themselves.
  const planHomeRef = useRef<() => Promise<void>>(async () => {});
  const askRef = useRef<
    (text: string, by: Said["by"], transcribeMs?: number) => Promise<void>
  >(async () => {});
  const [startMs] = useState(() =>
    at && Number.isFinite(Date.parse(at)) ? Date.parse(at) : Date.now(),
  );

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
      routeRef.current = next;
      setMode("walk");
      setRoute(next);
      setRouteKey((key) => key + 1);
      onRoute(next);
    },
    [onRoute],
  );

  const say = useCallback((text: string) => {
    setLine(text);
    speakAsMuse(text);
  }, []);

  // "Still working, the live model is slow" once a call runs past 10 s.
  const workingSince = phase.kind === "working" ? phase.startedAt : 0;
  useEffect(() => {
    if (!workingSince) return;
    const timer = setTimeout(
      () => setSlow(true),
      Math.max(0, SLOW_MS - (Date.now() - workingSince)),
    );
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [workingSince]);

  // The walk home, planned as the screen opens, revealed where you can see Muse work.
  const planHome = useCallback(async () => {
    const call = timed<MuseRouteResponse<ApiPlan>>(() =>
      fetch("/api/muse/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: studentSpot,
          to: { lat: HOME.lat, lng: HOME.lng },
          toLabel: HOME.name,
          mode: "walk",
          at: new Date(startMs).toISOString(),
          exclude: [],
        }),
      }),
    );
    await released();
    if (restoredRef.current) return;
    const revealStart = Date.now();
    setPhase({
      kind: "working",
      line: "Finding free food on your way home",
      startedAt: revealStart,
    });
    const result = await call;
    if (restoredRef.current) return;
    await wait(Math.max(0, MIN_REVEAL_MS - (Date.now() - revealStart)));
    const data = result.body?.data;
    if (!data) {
      setPhase({
        kind: "failed",
        line: "I couldn't plan that. Try again?",
        retry: () => void planHomeRef.current(),
      });
      return;
    }
    const home = dropLate(
      leadWith(
        toRoute(studentSpot, data, eventsById),
        promisedStopId ? eventsById.get(promisedStopId) : undefined,
        startMs,
      ),
      startMs,
    );
    show(home);
    setShareInvite(data.invite);
    // The real time Muse took, also when the /demo stage started the call early (lib/demo/head-start.ts).
    setLegs({ source: result.body?.source ?? "muse", planMs: result.body?.museMs ?? result.ms });
    setPhase({ kind: "ready" });
    say(homeLine(home));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A first visit: Muse reads each source on screen while the real curate call runs,
  // then lists her top events (the demo's story event first) and says one line.
  const curate = useCallback(async () => {
    const call = timed<CurateApi>(() =>
      fetch("/api/curate", { method: "POST" }),
    );
    const started = Date.now();
    for (const source of USER3_CONNECTORS) {
      setPhase({ kind: "working", line: source.reading, startedAt: started });
      await wait(SOURCE_STEP_MS);
    }
    setPhase({
      kind: "working",
      line: "Picking your top events",
      startedAt: started,
    });
    const result = await call;
    const found = (result.body?.data?.picks ?? []).map((pick) => ({
      eventId: pick.event.id,
      title: pick.event.title,
      placeName: pick.event.place.name,
      reason: pick.reason,
    }));
    if (found.length === 0) {
      setPhase({
        kind: "failed",
        line: "I couldn't read your feed. Try again?",
        retry: () => void planHomeRef.current(),
      });
      return;
    }
    setPicks(found);
    onPicks?.(found.map((pick) => pick.eventId));
    setLegs({
      source: result.body?.source ?? "muse",
      planMs: 0,
      curateMs: result.body?.museMs ?? result.ms,
    });
    setPhase({ kind: "ready" });
    // Muse's own line about her, from the real answer; her picks are the rows below.
    const summary = result.body?.data?.summary?.trim();
    say(summary ? brief(summary) : `${found[0]!.title} is your top pick.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planned = useRef(false);
  useEffect(() => {
    const first = opening === "curate" ? curate : planHome;
    planHomeRef.current = first;
    if (planned.current) return;
    planned.current = true;
    void first();
  }, [planHome, curate, opening]);

  // A request, spoken or typed: Muse ask, then the re-plan toward a friend, then the invite.
  const ask = useCallback(
    async (text: string, by: Said["by"], transcribeMs?: number) => {
      const question = text.trim();
      if (!question || busyRef.current) return;
      busyRef.current = true;
      stopSpeaking();
      setOpen(true);
      setSaid({ text: question, by });
      postToParent({ type: "said", text: question });
      const friend = friendNamedIn(question);
      const askStarted = Date.now();
      setPhase({
        kind: "working",
        line: friend
          ? `Finding a spot between you and ${friend.name}`
          : "Thinking about that",
        startedAt: askStarted,
      });
      if (friend) {
        // The old walk leaves the map; the friend's spot comes in while Muse works.
        onRoute(null);
        onPreviewSpot(friend);
      }
      // Shaped input, real call: with a friend named, Muse also hears which events sit between the
      // two of them and start soon, the demo's story event first when it is one of them.
      const between = (spot: Point) =>
        friend !== null &&
        walkMinutes(studentSpot, spot) + walkMinutes(spot, friend) <=
          walkMinutes(studentSpot, friend) * 1.6 + 3;
      const soon = (event: CrawlEvent) =>
        Date.parse(event.startIso) <= startMs + 60 * 60_000 &&
        Date.parse(event.endIso) > startMs + 30 * 60_000;
      const candidates = friend
        ? events.filter((event) => between(event.place) && soon(event))
        : [];
      // The demo's data is shaped so its story event is the one that fits: when it is among the
      // candidates, it is the one Muse hears about.
      const storyFits = candidates.find((event) => event.eventId === storyEventId);
      const nearBoth = storyFits ? [storyFits] : candidates.slice(0, 3);
      const shaped =
        nearBoth.length > 0
          ? `${question} (Starting soon and right between me and ${friend!.name}: ${nearBoth.map((event) => `${event.title} at ${event.place.name}`).join("; ")}. Pick from these.)`
          : question;
      const asked = await timed<MuseRouteResponse<AskReply>>(() =>
        fetch("/api/muse/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: shaped, fresh: true }),
        }),
      );
      const reply = asked.body?.data ?? null;
      const fail = () => {
        busyRef.current = false;
        onPreviewSpot(null);
        setPhase({
          kind: "failed",
          line: "I couldn't plan that. Try again?",
          retry: () => void askRef.current(question, by, transcribeMs),
        });
      };
      if (!reply) return fail();
      if (!reply.plan || !friend) {
        // Not a re-plan: Muse answers in a sentence.
        await wait(Math.max(0, 900 - (Date.now() - askStarted)));
        busyRef.current = false;
        onPreviewSpot(null);
        const answerLegs: Legs = {
          source: asked.body?.source ?? "muse",
          transcribeMs,
          askMs: asked.ms,
          planMs: 0,
        };
        setLegs(answerLegs);
        setPhase({ kind: "ready" });
        say(brief(reply.answer));
        shownSaidRef.current = question;
        keepSaid({
          text: question,
          by,
          view: { route: routeRef.current, legs: answerLegs, meet: null, friendEnd: null, invite: null, line: brief(reply.answer) },
        });
        return;
      }
      // Muse's own pick leads only when it really sits between the two of them; otherwise the
      // walk goes to the friend and the planner picks the stop on the way.
      const pickedId = reply.plan.eventId ?? reply.eventIds[0] ?? null;
      const candidate = pickedId ? eventsById.get(pickedId) : undefined;
      // The demo follows one event: when it is listed, the re-plan lands on it, and says so when Muse picked another.
      const story = storyEventId ? eventsById.get(storyEventId) : undefined;
      const picked =
        story ??
        (candidate && between(candidate.place) ? candidate : undefined);
      // Only when Muse really named another event: a second copy of the story event (same title
      // and place, from a repeated publish) is the same event, not a different suggestion.
      const sameEvent = (a: CrawlEvent, b: CrawlEvent) =>
        a.eventId === b.eventId ||
        (a.title.trim().toLowerCase() === b.title.trim().toLowerCase() &&
          a.place.name === b.place.name);
      const museSuggested =
        story && candidate && !sameEvent(candidate, story)
          ? candidate.title
          : undefined;
      let planMs = 0;
      let planSource: Source = "muse";
      let next: Route;
      let inviteMessage = `Want to join me for ${picked?.title ?? "this"}?`;
      if (picked) {
        // The plan is the one event Muse named: walk there, and the friend meets you there.
        next = retime(
          {
            from: studentSpot,
            stops: [],
            destination: {
              name: `${friend.name} at ${picked.place.name}`,
              lat: picked.place.lat,
              lng: picked.place.lng,
              arriveAt: new Date(startMs).toISOString(),
              walkMinutes: 0,
              mode: "walk",
            },
            totalWalkMinutes: 0,
          },
          startMs,
        );
        setMeet({ friend, title: picked.title });
      } else {
        const planned = await timed<MuseRouteResponse<ApiPlan>>(() =>
          fetch("/api/muse/crawl", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              from: studentSpot,
              // No stop named: walk to the friend, and the planner picks the stops on the way.
              to: { lat: friend.lat, lng: friend.lng },
              toLabel: `${friend.name} at ${friend.placeName}`,
              note: question,
              mode: "walk",
              at: new Date(startMs).toISOString(),
              exclude: [],
            }),
          }),
        );
        const data = planned.body?.data;
        if (!data) return fail();
        next = toRoute(studentSpot, data, eventsById);
        planMs = planned.ms;
        planSource = planned.body?.source ?? "muse";
        inviteMessage = data.invite.message;
        setMeet(null);
      }
      const stopId =
        picked?.eventId ??
        next.stops.find((stop) => stop.eventId)?.eventId ??
        null;
      const stopTitle =
        picked?.title ??
        next.stops.find((stop) => stop.eventId === stopId)?.title ??
        next.stops[0]?.title ??
        null;
      // The invite goes out before Muse says it did.
      let sent = false;
      if (stopId) {
        setInvite({ friend, state: "sending", eventId: stopId, message: inviteMessage });
        const response = await fetch("/api/social/invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            to: friend.id,
            eventId: stopId,
            message: inviteMessage,
          }),
        }).catch(() => null);
        sent = Boolean(response?.ok);
        setInvite({ friend, state: sent ? "sent" : "error", eventId: stopId, message: inviteMessage });
      }
      await wait(Math.max(0, MIN_REPLAN_MS - (Date.now() - askStarted)));
      busyRef.current = false;
      onPreviewSpot(null);
      setFriendEnd(picked ? null : friend);
      show(next);
      const live = asked.body?.source !== "fixture" && planSource !== "fixture";
      const replanLegs: Legs = {
        source: live ? "muse" : "fixture",
        transcribeMs,
        askMs: asked.ms,
        planMs,
        museSuggested,
      };
      setLegs(replanLegs);
      setPhase({ kind: "ready" });
      const where = shortPlace(friend.placeName).replace(/ Square$/, "");
      const answer = stopTitle
        ? `${friend.name}'s in ${where}, so I moved you to ${stopTitle}${sent ? ` and sent the invite` : ""}.`
        : brief(reply.answer);
      say(answer);
      // Kept for the run: the next beat, a reload, and the other screen show exactly this.
      shownSaidRef.current = question;
      keepSaid({
        text: question,
        by,
        view: {
          route: next,
          legs: replanLegs,
          meet: picked ? { friend, title: picked.title } : null,
          friendEnd: picked ? null : friend,
          invite: stopId ? { friend, state: sent ? "sent" : "error", eventId: stopId, message: inviteMessage } : null,
          line: answer,
        },
      });
    },
    [events, eventsById, onPreviewSpot, onRoute, say, show, startMs, storyEventId, studentSpot],
  );

  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  // Shows the run's kept request and Muse's exact answer, without asking or speaking again.
  const restore = useCallback(
    (kept: SaidRecord) => {
      if (shownSaidRef.current === kept.text) return;
      shownSaidRef.current = kept.text;
      restoredRef.current = true;
      revealRef.current.released = true;
      revealRef.current.resolve?.();
      busyRef.current = false;
      stopSpeaking();
      onPreviewSpot(null);
      setOpen(true);
      setSaid({ text: kept.text, by: kept.by });
      setInvite(kept.view.invite ?? null);
      setMeet(kept.view.meet ?? null);
      setFriendEnd(kept.view.friendEnd ?? null);
      if (kept.view.route) show(kept.view.route);
      setLegs(kept.view.legs ?? null);
      setPhase({ kind: "ready" });
      setLine(kept.view.line ?? null);
    },
    [onPreviewSpot, show],
  );

  // A request this screen did not hear itself (the scripted line, ?auto, words the
  // presenter's phone heard): once a request was made in this run, it is shown as
  // kept, never asked a second time. Words from the phone wait for the phone's answer.
  const askUnlessKept = useCallback(
    async (text: string, by: Said["by"], fromPhone = false) => {
      if (!isFramed()) return void ask(text, by);
      if (busyRef.current) return;
      let kept = await readKeptSaid();
      if (fromPhone && kept?.text !== text) {
        busyRef.current = true;
        setOpen(true);
        setSaid({ text, by });
        const friend = friendNamedIn(text);
        setPhase({
          kind: "working",
          line: friend ? `Finding a spot between you and ${friend.name}` : "Thinking about that",
          startedAt: Date.now(),
        });
        const until = Date.now() + HEARD_WAIT_MS;
        while (kept?.text !== text && Date.now() < until) {
          await wait(1000);
          kept = await readKeptSaid();
        }
        busyRef.current = false;
        if (kept?.text !== text) kept = null;
      }
      if (kept) return restore(kept);
      await ask(text, by);
    },
    [ask, restore],
  );

  // On open in a demo frame: the run's kept request replaces the walk home (a reload, Back then Next, a jump).
  const checkedKept = useRef(false);
  useEffect(() => {
    if (checkedKept.current || !isFramed()) return;
    checkedKept.current = true;
    void readKeptSaid().then((kept) => {
      if (kept && !busyRef.current) restore(kept);
    });
  }, [restore]);

  // Voice: tap to talk, tap again to send. End of speech also sends when it hears it first.
  const onClip = useCallback(
    async (wav: Blob) => {
      setPhase({ kind: "transcribing" });
      const form = new FormData();
      form.append("audio", wav, "question.wav");
      const result = await timed<MuseRouteResponse<{ transcript: string }>>(
        () => fetch("/api/muse/transcribe", { method: "POST", body: form }),
      );
      const transcript = result.body?.data?.transcript?.trim() ?? "";
      if (!transcript) {
        setPhase({
          kind: "failed",
          line: result.body?.data
            ? "I didn't hear anything. Tap to try again."
            : "I couldn't hear that. Tap to try again, or type it.",
          retry: null,
        });
        return;
      }
      await ask(transcript, "voice", result.ms);
    },
    [ask],
  );
  const recorder = useVoiceRecorder(onClip, () =>
    setPhase({
      kind: "failed",
      line: "I didn't hear anything. Tap to try again.",
      retry: null,
    }),
  );
  const listening = recorder.recording || mirrorListening;
  const bars = useMicLevel(recorder.recording);

  useEffect(() => {
    postToParent({ type: "listening", on: recorder.recording });
  }, [recorder.recording]);

  // A blocked or missing microphone says so, with Type beside the mic.
  useEffect(() => {
    if (!recorder.error) return;
    // The recorder reports a blocked mic only through its state; this turns it into Muse's line once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase({ kind: "failed", line: "Microphone is blocked. Tap Type to ask instead.", retry: null });
  }, [recorder.error]);

  // Hearing failed: tell the stage, so the projector shows the same line and never sits on Listening.
  const failedLine = phase.kind === "failed" ? phase.line : null;
  useEffect(() => {
    if (failedLine) postToParent({ type: "failed", text: failedLine });
  }, [failedLine]);

  const working = phase.kind === "working" || phase.kind === "transcribing";

  const toggleMic = useCallback(() => {
    if (recorder.recording) return recorder.stop();
    if (busyRef.current) return;
    stopSpeaking();
    setTyping(false);
    setOpen(true);
    void recorder.start({ autoStop: true });
  }, [recorder]);

  // The stage and the phones: heard words, a mirrored listening state, the reveal.
  useEffect(() => {
    if (!isFramed()) return;
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      const data = event.data as {
        source?: unknown;
        type?: unknown;
        text?: unknown;
        on?: unknown;
        line?: unknown;
      } | null;
      if (!data) return;
      if (data.type === "reveal") {
        revealRef.current.released = true;
        revealRef.current.resolve?.();
      } else if (
        data.source === "demo-stage" &&
        data.type === "listening" &&
        typeof data.on === "boolean"
      ) {
        setMirrorListening(data.on);
        if (data.on) setOpen(true);
      } else if (
        data.source === "demo-stage" &&
        data.type === "heard" &&
        typeof data.text === "string"
      ) {
        setMirrorListening(false);
        void askUnlessKept(data.text, "voice", true);
      } else if (
        data.source === "demo-stage" &&
        data.type === "failed" &&
        typeof data.text === "string"
      ) {
        // The presenter's phone could not hear her: show what it shows.
        setMirrorListening(false);
        if (!busyRef.current && data.text) setPhase({ kind: "failed", line: data.text, retry: null });
      } else if (data.type === "demo-ask" && typeof data.line === "string") {
        void askUnlessKept(data.line, "typed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [askUnlessKept]);

  // ?auto=1 on the laptop: type the request in once the walk is up.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!autoAsk || autoAsked.current || phase.kind !== "ready" || !route)
      return;
    autoAsked.current = true;
    const timer = setTimeout(() => void askUnlessKept(autoAsk, "typed"), 1500);
    return () => clearTimeout(timer);
  }, [autoAsk, phase.kind, route, askUnlessKept]);

  // The Muse button at the top right: while listening it sends, otherwise it shows or hides this card.
  const listeningRef = useRef(false);
  useEffect(() => {
    listeningRef.current = recorder.recording;
  }, [recorder.recording]);
  useEffect(() => {
    const onToggle = () => {
      if (listeningRef.current) return recorder.stop();
      setOpen((current) => !current);
    };
    window.addEventListener(MUSE_TOGGLE, onToggle);
    return () => window.removeEventListener(MUSE_TOGGLE, onToggle);
  }, [recorder]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MUSE_STATE, { detail: open }));
    window.dispatchEvent(new CustomEvent(MUSE_CARD, { detail: open }));
  }, [open]);

  useEffect(
    () => () => {
      stopSpeaking();
      window.dispatchEvent(new CustomEvent(MUSE_CARD, { detail: false }));
    },
    [],
  );

  // Muse's newest line stays in view: when her words and the answer outgrow the card, scroll
  // just far enough to show the whole line (or its top, if it is taller than the card).
  useEffect(() => {
    const box = scrollRef.current;
    const newest = newestRef.current;
    if (!box || !newest) return;
    const frame = requestAnimationFrame(() => {
      const outer = box.getBoundingClientRect();
      const inner = newest.getBoundingClientRect();
      if (inner.height > outer.height) box.scrollTop += inner.top - outer.top;
      else if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom + 8;
      else if (inner.top < outer.top) box.scrollTop += inner.top - outer.top;
    });
    return () => cancelAnimationFrame(frame);
  }, [line, said, phase, legs]);

  function submitTyped(formEvent: FormEvent) {
    formEvent.preventDefault();
    const text = typed;
    setTyped("");
    setTyping(false);
    void ask(text, "typed");
  }

  // The sheet's invite button tries a failed send again.
  const resendInvite = useCallback(async () => {
    if (!invite?.eventId) return;
    const { friend, eventId, message } = invite;
    setInvite({ ...invite, state: "sending" });
    const response = await fetch("/api/social/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: friend.id, eventId, message: message ?? "" }),
    }).catch(() => null);
    setInvite({ friend, eventId, message, state: response?.ok ? "sent" : "error" });
  }, [invite]);

  // "Send to a friend" on the walk home, the planner's share sheet.
  const share = async () => {
    if (!shareInvite) return;
    const url = shareInvite.path ? new URL(shareInvite.path, window.location.origin).toString() : undefined;
    try {
      if (navigator.share) await navigator.share({ text: shareInvite.message, url });
      else await navigator.clipboard.writeText(url ? `${shareInvite.message} ${url}` : shareInvite.message);
      setShared(true);
    } catch {
      // She closed the share sheet.
    }
  };

  const museLine =
    phase.kind === "working"
      ? slow
        ? "Still working, the live model is slow"
        : phase.line
      : phase.kind === "transcribing"
        ? "Got it"
        : phase.kind === "failed"
          ? phase.line
          : line;
  // While Muse works, the card shows what it is doing, never the old plan.
  const replanning = phase.kind === "working" || phase.kind === "transcribing";
  const stamp =
    phase.kind === "ready" && legs
      ? legs.source === "fixture"
        ? null
        : [
            legs.transcribeMs ? `heard ${seconds(legs.transcribeMs)}` : null,
            legs.askMs ? `asked ${seconds(legs.askMs)}` : null,
            legs.planMs ? `planned ${seconds(legs.planMs)}` : null,
            legs.curateMs ? `picked ${seconds(legs.curateMs)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
      : null;
  const end = route?.destination;
  const shownRoute = route && mode !== "walk" ? retime(route, startMs, mode) : route;
  const changeMode = (next: TravelMode) => {
    setMode(next);
    if (route) onRoute(next === "walk" ? route : retime(route, startMs, next));
  };
  const ready = phase.kind === "ready";
  const showRoute = Boolean(route && end && !replanning && !(picks && !said));
  // A first visit has no walk to act on: no actions row until Muse plans one.
  const actions = opening !== "curate" || Boolean(route);
  const micHint = listening
    ? "Listening. Tap when you're done."
    : phase.kind === "transcribing"
      ? "Got it"
      : working
        ? "Muse is answering"
        : "Tap to talk to Muse";

  return (
    <section
      aria-label="Muse"
      aria-hidden={!open || undefined}
      className={`${SHEET_CLASS} z-30 flex max-h-[78%] flex-col pt-2 transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "" : "pointer-events-none translate-y-full"}`}
    >
      <style>{CONVERSATION_CSS}</style>
      <SheetHandle className="shrink-0" />

      {/* The conversation and the stops scroll together; the mic and the actions below never move
          (a long exchange on a 664 px phone once pushed the mic under the tab bar). */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {/* Heading: her words, then Muse's line where the planner has its heading. */}
      <div className="px-4">
        {said && (
          <div className="mc-rise mb-[10px] flex items-end justify-end gap-[6px]">
            <span className="mb-[3px] flex shrink-0 items-center gap-[3px] text-meta text-muted">
              {said.by === "voice" ? (
                <MicGlyph className="h-[11px] w-[11px]" />
              ) : (
                <KeyboardGlyph className="h-[12px] w-[12px]" />
              )}
              {said.by === "voice" ? "Said" : "Typed"}
            </span>
            <p className="max-w-[82%] rounded-[18px] rounded-br-[6px] bg-wash px-[12px] py-[7px] text-body font-medium text-ink">
              {said.text}
            </p>
          </div>
        )}
        {/* Sprout and Muse's line where the planner has its heading; the facts under it run to the edge. */}
        <div ref={newestRef} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-[10px]">
          <span
            className={`rounded-full ${working ? "mc-thinking" : listening ? "mc-lean" : ""}`}
          >
            <MuseFace size={28} />
          </span>
          <div className="min-w-0 pt-[3px]" aria-live="polite">
            {museLine && (
              <h2
                key={museLine}
                className={`mc-rise font-display text-title font-bold leading-[22px] ${working ? "text-ink/80" : ""}`}
              >
                {museLine}
              </h2>
            )}
          </div>
          <SheetClose label="Close Muse" onClick={() => setOpen(false)} className="-mr-1" />
          <div className="col-span-2 col-start-2 min-w-0">
            {ready && showRoute && route && end && !meet && (
              <p className="mt-[3px] truncate text-meta font-semibold text-muted">
                {routeSummary(shownRoute ?? route, friendEnd ? `${friendEnd.name} at ${shortPlace(friendEnd.placeName)}` : shortPlace(end.name))}
              </p>
            )}
            {ready && legs && (
              <p className="mt-[2px] flex items-center gap-[4px] truncate text-meta text-muted">
                <MetaAiMark size={16} />
                {stamp ? `Live from Muse · ${stamp}` : stamp === "" ? "Live from Muse" : "Recorded answer"}
              </p>
            )}
            {ready && picks && !said && (
              <p className="mt-[2px] truncate text-meta text-muted">From sample email, calendar, Instagram and Reels</p>
            )}
            {phase.kind === "failed" && phase.retry && (
              <button type="button" onClick={phase.retry} className="mt-1 text-meta font-semibold text-primary">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>

      {showRoute && shownRoute && (
        <div role="tablist" aria-label="How you travel" className="mt-2 flex gap-[6px] px-4">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              onClick={() => changeMode(item.id)}
              className={`rounded-full px-[12px] py-[5px] text-meta font-semibold ${mode === item.id ? "bg-ink text-white" : "bg-wash text-ink"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Stops, in the planner's own rows. */}
      <ol className="mt-2 px-4">
        {replanning ? (
          [0, 1, 2].map((index) => <Placeholder key={index} index={index} />)
        ) : picks && !route ? (
          picks.map((pick, index) => {
            const path = HANDOFF.whosGoing(pick.eventId);
            return (
              <li
                key={pick.eventId}
                className="mc-rise border-t border-hairline"
                style={{ animationDelay: `${(index + 1) * STOP_STAGGER_MS}ms` }}
              >
                <Link
                  href={path}
                  onClick={(click) => {
                    click.preventDefault();
                    handOff(path, router.push);
                  }}
                  className="flex items-center gap-3 py-[8px]"
                >
                  <StopNumber n={index + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold">{pick.title}</span>
                    <span className="block truncate text-meta text-muted">{pick.reason}</span>
                  </span>
                </Link>
              </li>
            );
          })
        ) : showRoute && shownRoute && end ? (
          <>
            {/* A meet-up is one row (the event); a walk starts from her location, as in the planner. */}
            {shownRoute.stops.length > 0 && <StartRow leave={clock(new Date(startMs).toISOString())} />}
            {shownRoute.stops.map((stop, index) => (
              <StopRow
                key={`${routeKey}-${stop.title}`}
                stop={stop}
                index={index}
                until={stop.endsAt}
                className="mc-rise"
                style={{ animationDelay: `${(index + 1) * STOP_STAGGER_MS}ms` }}
              />
            ))}
            <EndRow
              glyph={friendEnd || meet ? PERSON_PATH : HOME_PATH}
              name={meet ? meet.title : friendEnd ? `${friendEnd.name} at ${shortPlace(friendEnd.placeName)}` : shortPlace(end.name)}
              walkMinutes={meet ? shownRoute.totalWalkMinutes : shownRoute.destination.walkMinutes}
              arriveAt={shownRoute.destination.arriveAt}
            />
          </>
        ) : null}
      </ol>
      {/* Small and out of the way: only when Muse named a different event than the demo's. */}
      {ready && legs?.museSuggested && (
        <p className="px-4 pb-1 text-meta text-muted">Set for the demo. Muse suggested {legs.museSuggested}.</p>
      )}
      </div>

      {/* Her answer to Muse: the mic, its own row above the actions. */}
      <div className={`flex shrink-0 items-center gap-3 border-t border-hairline px-4 pt-[8px] ${actions ? "pb-[8px]" : CLEAR_TABBAR}`}>
        {typing ? (
          <form onSubmit={submitTyped} className="flex min-w-0 flex-1 items-center gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(change) => setTyped(change.target.value)}
              placeholder="Ask Muse anything"
              aria-label="Ask Muse anything"
              className="h-[40px] min-w-0 flex-1 rounded-[10px] bg-wash px-3 text-label outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              aria-label="Send"
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
            >
              <SendGlyph className="h-[17px] w-[17px]" />
            </button>
            <button
              type="button"
              onClick={() => setTyping(false)}
              aria-label="Talk instead"
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-button text-ink"
            >
              <MicGlyph className="h-[19px] w-[19px]" />
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              data-muse-mic
              onClick={toggleMic}
              disabled={working && !recorder.recording}
              aria-label={recorder.recording ? "Send what you said" : "Talk to Muse"}
              aria-pressed={listening}
              className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50"
            >
              {listening && <span aria-hidden className="mc-ring absolute inset-0 rounded-full" />}
              {recorder.recording ? <SendGlyph className="h-[24px] w-[24px]" /> : <MicGlyph className="h-[26px] w-[26px]" />}
            </button>
            <div className="min-w-0 flex-1">
              {listening ? (
                <span className="flex h-[24px] items-center gap-[3px]" aria-hidden>
                  {(recorder.recording ? bars : Array(18).fill(0.06)).map((level, index) => (
                    <span
                      key={index}
                      className={`w-[3px] rounded-full bg-primary ${recorder.recording ? "" : "mc-idle-bar"}`}
                      style={{ height: `${Math.round(4 + level * 20)}px`, animationDelay: `${index * 60}ms` }}
                    />
                  ))}
                </span>
              ) : null}
              <p className={`truncate text-meta ${listening ? "font-semibold text-ink" : "text-muted"}`}>{micHint}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                recorder.cancel();
                setTyping(true);
              }}
              disabled={working}
              aria-label="Type instead"
              className="flex shrink-0 items-center gap-[5px] rounded-full bg-button px-3 py-[5px] text-meta font-semibold text-ink disabled:opacity-40"
            >
              <KeyboardGlyph className="h-[14px] w-[14px]" />
              Type
            </button>
          </>
        )}
      </div>

      {/* The planner's own bottom row: Get directions, and the invite. */}
      {actions && (
      <CrawlActions
        directionsUrl={showRoute && shownRoute ? googleDirectionsUrl(shownRoute, mode) : null}
        friendName={invite?.friend.name ?? null}
        invited={invite?.state ?? "idle"}
        onInvite={() => void resendInvite()}
        // On the demo stage, the sent invite passes the show to the friend's act.
        onSent={isFramed() ? handOverToFriend : undefined}
        onShare={() => void share()}
        shared={shared}
      />
      )}
    </section>
  );
}

const CONVERSATION_CSS = `
@keyframes mc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mc-ring { 0% { box-shadow: 0 0 0 0 rgba(8,102,255,.45); } 100% { box-shadow: 0 0 0 16px rgba(8,102,255,0); } }
@keyframes mc-thinking { 0%,100% { transform: rotate(-6deg) scale(1); } 50% { transform: rotate(6deg) scale(1.06); } }
@keyframes mc-wait { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes mc-idle { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(2.4); } }
.mc-rise { animation: mc-rise 320ms cubic-bezier(.3,.7,.3,1) both; }
.mc-ring { animation: mc-ring 1.1s ease-out infinite; }
.mc-thinking { animation: mc-thinking 1.2s ease-in-out infinite; }
.mc-lean { transform: rotate(-8deg) translateX(2px); transition: transform 200ms ease; }
.mc-wait { animation: mc-wait 1.3s ease-in-out infinite; }
.mc-idle-bar { animation: mc-idle .9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .mc-rise, .mc-ring, .mc-thinking, .mc-wait, .mc-idle-bar { animation: none; }
}
`;
