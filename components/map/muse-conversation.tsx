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
import { MuseFace } from "@/components/map/muse-menu";
import { speakAsMuse, stopSpeaking } from "@/components/map/muse-voice";
import { Avatar } from "@/components/social/whos-going";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { USER3_CONNECTORS } from "@/lib/curate/connectors";
import { HANDOFF, handOff } from "@/lib/demo/staged";
import { walkMinutes } from "@/lib/geo";
import {
  arrivesTooLate,
  googleDirectionsUrl,
  retime,
  type Point,
  type Route,
  type RouteStop,
} from "@/lib/map/crawl-route";
import { friendNamedIn, type FriendSpot } from "@/lib/map/friend-spots";
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
//                     and {source: "demo-screen", type: "pass"} (the Sent chip passes the show to the friend)
//   parent to screen: {source: "demo-stage", type: "heard", text}, {type: "listening", on}, {type: "reveal"},
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
type Invite = { friend: FriendSpot; state: "sending" | "sent" | "error" };
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
const MUSE_TOGGLE = "muse:toggle";
const MUSE_STATE = "muse:state";
// Tells the alert nudge to stay away while the card is up (components/demo/nearby-watcher-gate.tsx).
export const MUSE_CARD = "muse:card";
// Home for the demo student until the profile carries a dorm (the same spot the crawl planner uses).
const HOME = { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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

function clock(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: CAMPUS_TIME_ZONE,
    })
    .replace(":00", "");
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

function CloseGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function EndGlyph({
  friend,
  className,
}: {
  friend: boolean;
  className?: string;
}) {
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
      <path
        d={
          friend
            ? "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0"
            : "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10"
        }
      />
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

function StopRow({
  stop,
  index,
  dim,
  delay,
}: {
  stop: RouteStop;
  index: number;
  dim: boolean;
  delay: number;
}) {
  const fact = [
    `${stop.walkMinutes} min walk`,
    stop.endsAt ? `until ${clock(stop.endsAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      className={`mc-rise flex h-[52px] items-center gap-[10px] transition-opacity duration-300 ${dim ? "opacity-40" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-[12px] font-bold text-on-primary">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-label font-bold">
          {stop.title}
        </span>
        <span className="block truncate text-meta text-muted">{fact}</span>
      </span>
    </li>
  );
}

function Placeholder({ index }: { index: number }) {
  return (
    <li className="flex h-[52px] items-center gap-[10px]" aria-hidden>
      <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-wash" />
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
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [mirrorListening, setMirrorListening] = useState(false);
  const [slow, setSlow] = useState(false);
  const revealRef = useRef<{ released: boolean; resolve: (() => void) | null }>(
    { released: !holdReveal, resolve: null },
  );
  const busyRef = useRef(false);
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
    const revealStart = Date.now();
    setPhase({
      kind: "working",
      line: "Finding free food on your way home",
      startedAt: revealStart,
    });
    const result = await call;
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
    const home = leadWith(
      toRoute(studentSpot, data, eventsById),
      promisedStopId ? eventsById.get(promisedStopId) : undefined,
      startMs,
    );
    show(home);
    setLegs({ source: result.body?.source ?? "muse", planMs: result.ms });
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
      curateMs: result.ms,
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
        setLegs({
          source: asked.body?.source ?? "muse",
          transcribeMs,
          askMs: asked.ms,
          planMs: 0,
        });
        setPhase({ kind: "ready" });
        say(brief(reply.answer));
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
      const museSuggested =
        story && candidate && candidate.eventId !== story.eventId
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
        setInvite({ friend, state: "sending" });
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
        setInvite({ friend, state: sent ? "sent" : "error" });
      }
      await wait(Math.max(0, MIN_REPLAN_MS - (Date.now() - askStarted)));
      busyRef.current = false;
      onPreviewSpot(null);
      setFriendEnd(picked ? null : friend);
      show(next);
      const live = asked.body?.source !== "fixture" && planSource !== "fixture";
      setLegs({
        source: live ? "muse" : "fixture",
        transcribeMs,
        askMs: asked.ms,
        planMs,
        museSuggested,
      });
      setPhase({ kind: "ready" });
      const where = shortPlace(friend.placeName).replace(/ Square$/, "");
      say(
        stopTitle
          ? `${friend.name}'s in ${where}, so I moved you to ${stopTitle}${sent ? ` and sent the invite` : ""}.`
          : brief(reply.answer),
      );
    },
    [events, eventsById, onPreviewSpot, onRoute, say, show, startMs, storyEventId, studentSpot],
  );

  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

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
    if (!autoAsk || autoAsked.current || phase.kind !== "ready" || !route)
      return;
    autoAsked.current = true;
    const timer = setTimeout(() => void ask(autoAsk, "typed"), 1500);
    return () => clearTimeout(timer);
  }, [autoAsk, phase.kind, route, ask]);

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

  function submitTyped(formEvent: FormEvent) {
    formEvent.preventDefault();
    const text = typed;
    setTyped("");
    setTyping(false);
    void ask(text, "typed");
  }

  const museLine = listening
    ? "Listening"
    : phase.kind === "working"
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

  return (
    <section
      aria-label="Muse"
      aria-hidden={!open || undefined}
      className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[60%] flex-col rounded-t-[20px] bg-card pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+10px)] shadow-[0_-6px_24px_rgba(0,0,0,0.14)] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "" : "pointer-events-none translate-y-full"}`}
    >
      <style>{CONVERSATION_CSS}</style>

      {/* Muse's line: always on top, never scrolls. */}
      <div className="shrink-0 px-4 pt-3">
        {said && (
          <div className="mc-rise mb-[8px] flex flex-col items-end">
            <p className="max-w-[86%] rounded-[18px] rounded-br-[6px] bg-wash px-[12px] py-[7px] text-body font-medium text-ink">
              {said.text}
            </p>
            <p className="mt-[2px] flex items-center gap-[4px] text-meta text-muted">
              {said.by === "voice" ? (
                <MicGlyph className="h-[11px] w-[11px]" />
              ) : (
                <KeyboardGlyph className="h-[12px] w-[12px]" />
              )}
              {said.by === "voice" ? "Said" : "Typed"}
            </p>
          </div>
        )}
        <div className="flex items-start gap-[10px]">
          <span
            className={`mt-[1px] shrink-0 rounded-full ${working ? "mc-thinking" : listening ? "mc-lean" : ""}`}
          >
            <MuseFace size={32} />
          </span>
          <div className="min-w-0 flex-1 pt-[5px]" aria-live="polite">
            {listening ? (
              <div className="flex items-center gap-[8px]">
                <span className="font-display text-label font-bold">
                  Listening
                </span>
                <span
                  className="flex h-[22px] flex-1 items-center gap-[2px]"
                  aria-hidden
                >
                  {(recorder.recording ? bars : Array(18).fill(0.06)).map(
                    (level, index) => (
                      <span
                        key={index}
                        className={`w-[3px] rounded-full bg-primary ${recorder.recording ? "" : "mc-idle-bar"}`}
                        style={{
                          height: `${Math.round(4 + level * 18)}px`,
                          animationDelay: `${index * 60}ms`,
                        }}
                      />
                    ),
                  )}
                </span>
              </div>
            ) : (
              museLine && (
                <p
                  key={museLine}
                  className={`mc-rise text-body ${working ? "font-display font-bold" : "font-medium"} text-ink`}
                >
                  {museLine}
                </p>
              )
            )}
            {stamp && (
              <p className="mt-[2px] text-meta text-muted">
                Live from Muse · {stamp}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Muse"
            className="-mt-[6px] -mr-[10px] flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted"
          >
            <CloseGlyph className="h-[16px] w-[16px]" />
          </button>
        </div>
        {/* Status chips, only when true. */}
        {phase.kind === "ready" &&
          (invite || legs?.source === "fixture" || legs?.museSuggested || picks) && (
            <div className="mt-[6px] flex flex-wrap gap-[6px] pl-[42px]">
              {invite && (
                // On the demo stage, tapping "Sent to Lisa" passes the show to her act (the stage and the presenter phone both listen).
                <span
                  role={invite.state === "sent" && isFramed() ? "button" : undefined}
                  tabIndex={invite.state === "sent" && isFramed() ? 0 : undefined}
                  onClick={invite.state === "sent" ? handOverToFriend : undefined}
                  className="mc-rise flex items-center gap-[6px] rounded-full bg-primary-soft py-[3px] pr-[10px] pl-[3px] font-display text-meta font-bold text-link">
                  <Avatar
                    person={{ id: invite.friend.id, name: invite.friend.name }}
                    size={20}
                  />
                  {invite.state === "sent"
                    ? `Sent to ${invite.friend.name}`
                    : invite.state === "sending"
                      ? `Sending to ${invite.friend.name}`
                      : `Couldn't send to ${invite.friend.name}`}
                </span>
              )}
              {legs?.museSuggested && (
                <span className="rounded-full bg-button px-[10px] py-[3px] font-display text-meta font-bold text-muted">
                  Set for the demo · Muse suggested {legs.museSuggested}
                </span>
              )}
              {picks && !said && (
                <span className="rounded-full bg-button px-[10px] py-[3px] font-display text-meta font-bold text-muted">
                  Sample email, calendar, Instagram and Reels
                </span>
              )}
              {legs?.source === "fixture" && (
                <span className="rounded-full bg-button px-[10px] py-[3px] font-display text-meta font-bold text-muted">
                  Recorded answer
                </span>
              )}
            </div>
          )}
        {phase.kind === "failed" && phase.retry && (
          <button
            type="button"
            onClick={phase.retry}
            className="mt-[6px] ml-[42px] h-[32px] rounded-full bg-button px-[14px] font-display text-meta font-bold"
          >
            Try again
          </button>
        )}
      </div>

      {/* Stops: the only part that scrolls. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {replanning ? (
          <ol className="mt-[4px]">
            {[0, 1, 2].map((index) => (
              <Placeholder key={index} index={index} />
            ))}
          </ol>
        ) : picks && !route ? (
          <ol className="mt-[4px]">
            {picks.map((pick, index) => {
              const path = HANDOFF.whosGoing(pick.eventId);
              return (
                <li
                  key={pick.eventId}
                  className="mc-rise"
                  style={{ animationDelay: `${(index + 1) * STOP_STAGGER_MS}ms` }}
                >
                  <Link
                    href={path}
                    onClick={(click) => {
                      click.preventDefault();
                      handOff(path, router.push);
                    }}
                    className="flex min-h-[52px] items-center gap-[10px] py-[4px]"
                  >
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-[12px] font-bold text-on-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-label font-bold">
                        {pick.title}
                      </span>
                      <span className="block truncate text-meta text-muted">
                        {pick.reason}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : route && route.stops.length > 0 ? (
          <ol key={routeKey} className="mt-[4px]">
            {route.stops.map((stop, index) => (
              <StopRow
                key={`${routeKey}-${stop.title}`}
                stop={stop}
                index={index}
                dim={false}
                delay={(index + 1) * STOP_STAGGER_MS}
              />
            ))}
          </ol>
        ) : null}
        {end && !replanning && (
          <div
            className={`flex h-[44px] items-center gap-[10px] border-t border-hairline transition-opacity duration-300 ${replanning ? "opacity-40" : ""}`}
          >
            <span
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white ${meet ? "bg-primary" : "bg-ink"}`}
            >
              <EndGlyph
                friend={friendEnd !== null || meet !== null}
                className="h-[13px] w-[13px]"
              />
            </span>
            {meet ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-label font-bold">
                  {meet.title}
                </span>
                <span className="block truncate text-meta text-muted">
                  {meet.friend.name} meets you there · {route.totalWalkMinutes}{" "}
                  min walk · by {clock(end.arriveAt)}
                </span>
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-label font-semibold">
                  {friendEnd
                    ? `${friendEnd.name} at ${shortPlace(friendEnd.placeName)}`
                    : shortPlace(end.name)}
                </span>
                <span className="text-meta text-muted">
                  {route.totalWalkMinutes} min · by {clock(end.arriveAt)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls: pinned. */}
      <div className="shrink-0 px-4 pt-[8px]">
        {typing ? (
          <form onSubmit={submitTyped} className="flex items-center gap-[8px]">
            <input
              autoFocus
              value={typed}
              onChange={(change) => setTyped(change.target.value)}
              placeholder="Ask Muse anything"
              aria-label="Ask Muse anything"
              className="h-[44px] min-w-0 flex-1 rounded-full bg-wash px-[14px] text-body outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              aria-label="Send"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
            >
              <SendGlyph className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setTyping(false)}
              aria-label="Talk instead"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-button text-ink"
            >
              <MicGlyph className="h-[20px] w-[20px]" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-[10px]">
            {route && !listening ? (
              <a
                href={googleDirectionsUrl(route)}
                target="_blank"
                rel="noreferrer"
                className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] bg-button font-display text-label font-bold text-ink"
              >
                Get directions
              </a>
            ) : (
              <span className="flex-1 text-meta text-muted">
                {listening ? "Tap the mic again when you're done" : ""}
              </span>
            )}
            <button
              type="button"
              data-muse-mic
              onClick={toggleMic}
              disabled={working && !recorder.recording}
              aria-label={
                recorder.recording ? "Send what you said" : "Talk to Muse"
              }
              aria-pressed={listening}
              className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50"
            >
              {listening && (
                <span
                  aria-hidden
                  className="mc-ring absolute inset-0 rounded-full"
                />
              )}
              {recorder.recording ? (
                <SendGlyph className="h-[26px] w-[26px]" />
              ) : (
                <MicGlyph className="h-[28px] w-[28px]" />
              )}
            </button>
            <div className="flex flex-1 justify-end">
              <button
                type="button"
                onClick={() => {
                  recorder.cancel();
                  setTyping(true);
                }}
                disabled={working}
                aria-label="Type instead"
                className="flex h-[40px] items-center gap-[6px] rounded-[10px] bg-button px-[12px] font-display text-label font-bold text-ink disabled:opacity-50"
              >
                <KeyboardGlyph className="h-[16px] w-[16px]" />
                Type
              </button>
            </div>
          </div>
        )}
      </div>
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
