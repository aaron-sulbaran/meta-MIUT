"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BrandMark } from "@/components/demo/brand-mark";
import { CrossAppSheet, DrawnAvatar, IgIcons, SheetGlyphs, StagedMark } from "@/components/demo/instagram";
import { HANDOFF, STORY_POST, handOff } from "@/lib/demo/staged";

// U3a: Trish scrolls Instagram Reels (layout from the hub's kb/instagram-reels-ui).
// Three reels with moving pictures drawn here in SVG and CSS, nothing filmed or
// copied. Swipe (or wheel, or the arrow keys) snaps reel to reel; a tap pauses.
// On the third reel, the club's, a sticker-style pill slides in above the audio
// line without stopping the video; tapping it opens Instagram's cross-app sheet,
// whose button opens Facebook Events.
//
// Each reel is a demo beat (U3a1 to U3a3, then U3a4 with the sheet open). When
// Trish moves on, this screen tells its wrapper with a "demo-handoff" for the next
// beat's path, one step at a time, waiting for the wrapper's "demo-beat" before
// the next. The stage moves this screen in place with {type: "demo-reel", reel, sheet}.

// Where the sheet's button goes: Trish's first visit to Facebook Events (beat U3b).
export const REELS_NEXT = HANDOFF.curateAuto;

const BEAT_STEP: Record<string, number> = { U3a1: 0, U3a2: 1, U3a3: 2, U3a4: 3 };
const stepPath = (step: number) => HANDOFF.reels(Math.min(step, 2) + 1, step === 3);
const PILL_DELAY_MS = 1200;

type Reel = {
  handle: string;
  caption: string;
  audio: string;
  counts: [string, string, string, string];
  seconds: number;
  scene: ReactNode;
  art: string;
};

const REELS: Reel[] = [
  {
    handle: "maya.sails",
    caption: "golden hour on the charles before psets ate my whole week",
    audio: "maya.sails · Original audio",
    counts: ["12.4K", "231", "88", "1,052"],
    seconds: 9,
    scene: <SailScene />,
    art: "linear-gradient(160deg,#f6a65a,#c2557a)",
  },
  {
    handle: "leo.eats.late",
    caption: "3am ramen in the dorm kitchen is a personality trait at this point",
    audio: "leo.eats.late · Original audio",
    counts: ["8,903", "412", "57", "2,310"],
    seconds: 7,
    scene: <RamenScene />,
    art: "linear-gradient(160deg,#e8a253,#3a2416)",
  },
  {
    handle: STORY_POST.organizer.handle,
    caption: `${STORY_POST.title} tonight at the MIT Museum. 40 games, free dumplings while they last, no experience needed. Bring a friend or make one.`,
    audio: `${STORY_POST.organizer.handle} · Original audio`,
    counts: ["1,288", "64", "19", "203"],
    seconds: 8,
    scene: <BoardGameScene />,
    art: "linear-gradient(160deg,#2f9a6a,#0d3b28)",
  },
];

export function InstagramReels({ startReel, startSheet }: { startReel: number; startSheet: boolean }) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reel, setReel] = useState(startReel);
  const [sheet, setSheet] = useState(startSheet);
  const [pill, setPill] = useState(startSheet || startReel === 2);
  const [paused, setPaused] = useState(false);

  // What the wrapper (the phone page or the stage) already knows, and whether a move is in flight.
  const step = sheet ? 3 : reel;
  const stepRef = useRef(step);
  const reportedRef = useRef(startSheet ? 3 : startReel);
  const pendingRef = useRef(false);
  const sawBeatRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useCallback(function report() {
    if (typeof window === "undefined" || window.parent === window) return;
    if (pendingRef.current || stepRef.current <= reportedRef.current) return;
    const next = reportedRef.current + 1;
    reportedRef.current = next;
    pendingRef.current = true;
    window.parent.postMessage({ type: "demo-handoff", path: stepPath(next) }, window.location.origin);
    // The phone page answers with "demo-beat" once the stage has moved; the laptop stage moves at once.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => {
        pendingRef.current = false;
        report();
      },
      sawBeatRef.current ? 2500 : 450,
    );
  }, []);

  useEffect(() => {
    stepRef.current = step;
    report();
  }, [step, report]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const scrollTo = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(REELS.length - 1, index));
    scroller.scrollTo({ top: clamped * scroller.clientHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useLayoutEffect(() => {
    scrollTo(startReel, false);
  }, [scrollTo, startReel]);

  // The stage moves this screen in place; the phone page says which beat the stage is on.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { type?: unknown; reel?: unknown; sheet?: unknown; id?: unknown } | null;
      if (data?.type === "demo-reel" && typeof data.reel === "number") {
        const target = data.sheet === true ? 3 : data.reel - 1;
        reportedRef.current = Math.max(reportedRef.current, target);
        scrollTo(data.reel - 1, true);
        if (data.sheet === true) {
          setPill(true);
          setSheet(true);
        }
      } else if (data?.type === "demo-beat" && typeof data.id === "string" && data.id in BEAT_STEP) {
        sawBeatRef.current = true;
        reportedRef.current = BEAT_STEP[data.id]!;
        pendingRef.current = false;
        report();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [report, scrollTo]);

  // A laptop: wheel scrolls natively; the arrow keys and Page keys step a reel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheet) return;
      if (["ArrowDown", "PageDown", "j"].includes(event.key)) {
        event.preventDefault();
        scrollTo(reel + 1, true);
      } else if (["ArrowUp", "PageUp", "k"].includes(event.key)) {
        event.preventDefault();
        scrollTo(reel - 1, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reel, sheet, scrollTo]);

  // The prompt arrives a moment after the club's reel starts, and stays.
  useEffect(() => {
    if (reel !== 2 || pill) return;
    const timer = setTimeout(() => setPill(true), PILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reel, pill]);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientHeight === 0) return;
    const index = Math.round(scroller.scrollTop / scroller.clientHeight);
    if (index !== reel) {
      setReel(index);
      setPaused(false);
    }
  };

  return (
    <div
      aria-label="Staged Instagram Reels"
      className="fixed inset-y-0 left-1/2 z-40 flex w-full max-w-[390px] -translate-x-1/2 flex-col overflow-hidden bg-black font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-white"
    >
      <style>{REEL_CSS}</style>

      <div ref={scrollerRef} onScroll={onScroll} className="no-scrollbar relative min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {REELS.map((item, index) => (
          <section
            key={item.handle}
            aria-label={`Reel ${index + 1} of ${REELS.length}, by ${item.handle}`}
            className={`relative h-full w-full snap-start snap-always overflow-hidden ${paused && index === reel ? "reel-paused" : ""}`}
          >
            <button
              type="button"
              aria-label={paused && index === reel ? "Play" : "Pause"}
              onClick={() => setPaused((now) => !now)}
              className="absolute inset-0 block h-full w-full cursor-default"
            >
              {item.scene}
            </button>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-black/45 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[240px] bg-gradient-to-t from-black/60 to-transparent" />
            {paused && index === reel && (
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35">
                <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="white">
                  <path d="M7 4.5v15l12.5-7.5Z" />
                </svg>
              </span>
            )}
            <RightRail reel={item} />
            <div className="absolute bottom-[14px] left-[12px] right-[64px] flex flex-col gap-[8px] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-[10px]">
                <DrawnAvatar name={item.handle} size={32} />
                <span className="truncate text-[14px] font-semibold">{item.handle}</span>
                <span className="flex h-[28px] shrink-0 items-center rounded-[8px] border border-white/90 px-[11px] text-[12px] font-semibold">Follow</span>
              </div>
              <p className="text-[14px] leading-[18px]">
                <span className="line-clamp-1">{item.caption}</span>
              </p>
              {index === 2 && pill && (
                <button
                  type="button"
                  onClick={() => setSheet(true)}
                  className="flex h-[28px] w-fit items-center gap-[6px] rounded-full bg-white/20 pl-[6px] pr-[10px] text-[12px] font-semibold backdrop-blur-md motion-safe:animate-[reel-pill-in_420ms_cubic-bezier(0.2,0.8,0.2,1)]"
                >
                  <BrandMark name="facebook" size={18} decorative />
                  Check this out on Facebook Events
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </button>
              )}
              <p className="flex items-center gap-[6px] text-[12px]">
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] shrink-0" aria-hidden fill="currentColor">
                  <path d="M9 4.5v10.2a3.2 3.2 0 1 0 1.8 2.9V8.3l8.4-1.9v6.3a3.2 3.2 0 1 0 1.8 2.9V2.3Z" />
                </svg>
                <span className="truncate">{item.audio}</span>
              </p>
            </div>
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-white/30">
              <div className="reel-progress h-full bg-white" style={{ animationDuration: `${item.seconds}s` }} />
            </div>
          </section>
        ))}
      </div>

      <ReelsTop />
      <ReelsTabBar />
      <StagedMark />

      {/* The sheet is Instagram's light sheet: black text, not the reel's white. */}
      {sheet && (
        <div className="text-black">
        <CrossAppSheet
          titleId="reels-events-title"
          title="Check this out on Facebook Events?"
          rows={[
            {
              glyph: SheetGlyphs.facebook,
              detail: (
                <>
                  Open <strong className="font-bold text-black">{STORY_POST.organizer.handle}</strong>&apos;s event on Facebook. You already have a Facebook account, so there is nothing to sign up for.
                </>
              ),
            },
            {
              glyph: SheetGlyphs.people,
              lead: "See who's going",
              detail: "And what else is on near you today.",
            },
          ]}
          action="Open Facebook Events"
          onAction={() => handOff(REELS_NEXT, router.push)}
          decline="Not now"
          onDecline={() => setSheet(false)}
        />
        </div>
      )}
    </div>
  );
}

const railStroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function RightRail({ reel }: { reel: Reel }) {
  const repost = (
    <svg viewBox="0 0 24 24" className="h-[28px] w-[28px]" aria-hidden {...railStroke}>
      <path d="M4.5 11V9a3 3 0 0 1 3-3h11m0 0-3-3m3 3-3 3M19.5 13v2a3 3 0 0 1-3 3h-11m0 0 3 3m-3-3 3-3" />
    </svg>
  );
  const items: [ReactNode, string][] = [
    [IgIcons.heart("h-[28px] w-[28px]"), reel.counts[0]],
    [IgIcons.comment("h-[28px] w-[28px]"), reel.counts[1]],
    [repost, reel.counts[2]],
    [IgIcons.send("h-[28px] w-[28px]"), reel.counts[3]],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-[16px] right-[10px] flex w-[44px] flex-col items-center gap-[20px] [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.35))]">
      {items.map(([icon, count]) => (
        <span key={count} className="flex flex-col items-center gap-[4px]">
          {icon}
          <span className="text-[12px] font-semibold leading-none">{count}</span>
        </span>
      ))}
      {IgIcons.more("h-[24px] w-[24px]")}
      <span className="h-[26px] w-[26px] rounded-[6px] border-[1.5px] border-white" style={{ background: reel.art }} />
    </div>
  );
}

function ReelsTop() {
  return (
    <header aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex h-[44px] items-center justify-between px-[14px] pt-0 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.35))]" style={{ marginTop: "max(47px, env(safe-area-inset-top))" }}>
      {IgIcons.plus("h-[26px] w-[26px]")}
      <span className="flex items-center gap-[22px] text-[16px]">
        <span className="font-semibold text-white/60">Friends</span>
        <span className="font-semibold text-white">Reels</span>
      </span>
      {/* Your Algorithm: two lines, each with a small heart. */}
      <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" {...railStroke}>
        <path d="M3.5 8h9M3.5 16h9" />
        <path d="M17.5 10.4s-2.8-1.6-2.8-3.4a1.4 1.4 0 0 1 2.8-.6 1.4 1.4 0 0 1 2.8.6c0 1.8-2.8 3.4-2.8 3.4ZM17.5 18.4s-2.8-1.6-2.8-3.4a1.4 1.4 0 0 1 2.8-.6 1.4 1.4 0 0 1 2.8.6c0 1.8-2.8 3.4-2.8 3.4Z" />
      </svg>
    </header>
  );
}

/** Instagram's bottom bar in the new order (Home, Reels, Messages, Search, Profile), Reels active; inert. */
function ReelsTabBar() {
  return (
    <nav aria-hidden className="flex shrink-0 items-center justify-around bg-black pb-[max(14px,env(safe-area-inset-bottom))] pt-[10px] text-white">
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...railStroke}>
        <path d="M3.5 10.4 12 3.5l8.5 6.9V20.5h-5.6v-6h-5.8v6H3.5Z" />
      </svg>
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="white" />
        <path d="M3 8.5h18M9 3l2.6 5.5M15 3l2.6 5.5" stroke="black" strokeWidth={1.7} fill="none" />
        <path d="M10.3 11.6v5.6l4.6-2.8Z" fill="black" />
      </svg>
      {IgIcons.send()}
      {IgIcons.search()}
      <DrawnAvatar name="trish" size={26} />
    </nav>
  );
}

// The moving pictures: plain SVG shapes on CSS loops. Paused reels freeze in place.
const REEL_CSS = `
@keyframes reel-pill-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes reel-progress{from{width:0}to{width:100%}}
@keyframes reel-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes reel-rock{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) translateY(-3px)}}
@keyframes reel-wave{from{transform:translateX(0)}to{transform:translateX(-390px)}}
@keyframes reel-shimmer{0%,100%{opacity:.25}50%{opacity:.9}}
@keyframes reel-steam{0%{transform:translateY(0) scaleX(1);opacity:0}25%{opacity:.75}100%{transform:translateY(-150px) scaleX(1.4);opacity:0}}
@keyframes reel-chop{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg) translateY(-14px)}}
@keyframes reel-tumble{0%{transform:translate(-120px,-260px) rotate(0)}40%{transform:translate(0,0) rotate(380deg)}52%{transform:translate(14px,-40px) rotate(430deg)}64%,100%{transform:translate(22px,0) rotate(450deg)}}
@keyframes reel-tumble2{0%{transform:translate(140px,-300px) rotate(0)}44%{transform:translate(0,0) rotate(-400deg)}56%{transform:translate(-10px,-34px) rotate(-440deg)}68%,100%{transform:translate(-16px,0) rotate(-450deg)}}
@keyframes reel-hop{0%,70%,100%{transform:translateY(0)}80%{transform:translateY(-18px)}}
@keyframes reel-slide{0%,100%{transform:translateX(0) rotate(-8deg)}50%{transform:translateX(18px) rotate(-3deg)}}
.reel-progress{animation-name:reel-progress;animation-timing-function:linear;animation-iteration-count:infinite}
.reel-scene *{transform-box:fill-box;transform-origin:center}
.reel-paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){.reel-scene *{animation-duration:0s!important}}
`;

function Scene({ children, defs }: { children: ReactNode; defs?: ReactNode }) {
  return (
    <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" className="reel-scene absolute inset-0 h-full w-full" aria-hidden>
      {defs && <defs>{defs}</defs>}
      {children}
    </svg>
  );
}

function SailScene() {
  const wave = "M0 0 q24 -8 48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0";
  return (
    <Scene
      defs={
        <>
          <linearGradient id="sail-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b1b4a" />
            <stop offset="0.42" stopColor="#c2557a" />
            <stop offset="0.6" stopColor="#f6a65a" />
          </linearGradient>
          <linearGradient id="sail-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a4470" />
            <stop offset="1" stopColor="#1d1838" />
          </linearGradient>
        </>
      }
    >
      <rect width="390" height="844" fill="url(#sail-sky)" />
      <circle cx="210" cy="455" r="48" fill="#ffd98a" style={{ animation: "reel-bob 6s ease-in-out infinite" }} />
      <path d="M0 520V488h22v-14h16v14h20v-30h14v30h26v-18h18v18h30v-44h12v44h24v-22h20v22h36v-12h26v12h28v-36h16v36h24v-16h22v16h16v32Z" fill="#2a1838" />
      <rect y="520" width="390" height="324" fill="url(#sail-water)" />
      {[548, 572, 600, 632].map((y, i) => (
        <rect key={y} x={180 - i * 10} y={y} width={60 + i * 20} height="3" rx="1.5" fill="#ffd98a" style={{ animation: `reel-shimmer ${1.6 + i * 0.4}s ease-in-out infinite` }} />
      ))}
      {[560, 610, 680, 760].map((y, i) => (
        <g key={y} style={{ animation: `reel-wave ${7 + i * 2}s linear infinite` }}>
          <path d={wave} transform={`translate(0 ${y})`} fill="none" stroke="#ffffff" strokeOpacity={0.18 + i * 0.05} strokeWidth="2" />
        </g>
      ))}
      <g style={{ animation: "reel-rock 3.4s ease-in-out infinite" }}>
        <path d="M118 600h96l-14 18h-70Z" fill="#141022" />
        <path d="M164 598V488" stroke="#141022" strokeWidth="3" />
        <path d="M167 494 214 590h-47Z" fill="#fff4e6" />
        <path d="M161 506 126 590h35Z" fill="#ffe1c2" />
      </g>
    </Scene>
  );
}

function RamenScene() {
  return (
    <Scene
      defs={
        <radialGradient id="ramen-glow" cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6a4022" />
          <stop offset="1" stopColor="#120a06" />
        </radialGradient>
      }
    >
      <rect width="390" height="844" fill="url(#ramen-glow)" />
      <rect y="560" width="390" height="284" fill="#2a1a10" />
      <rect y="556" width="390" height="6" fill="#3d2718" />
      {[150, 195, 240].map((x, i) => (
        <path
          key={x}
          d={`M${x} 470 c-16 -22 16 -40 0 -62 c-16 -22 16 -40 0 -62`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="7"
          strokeLinecap="round"
          style={{ animation: `reel-steam 3.2s ease-out ${i * 1.05}s infinite` }}
        />
      ))}
      <ellipse cx="195" cy="500" rx="132" ry="30" fill="#e8a253" />
      <path d="M78 512 c10 18 30 34 60 34 c18 18 96 18 114 0 c30 0 50 -16 60 -34 Z" fill="#f2efe9" />
      <path d="M63 500 a132 30 0 0 0 264 0 c0 70 -60 112 -132 112 c-72 0 -132 -42 -132 -112Z" fill="#c8402f" />
      <path d="M63 500 a132 30 0 0 0 264 0" fill="none" stroke="#f2efe9" strokeWidth="6" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${120 + i * 34} 492 q10 10 20 0 t20 0`} fill="none" stroke="#fff3c4" strokeWidth="4" strokeLinecap="round" />
      ))}
      <ellipse cx="248" cy="492" rx="22" ry="12" fill="#fffaf0" />
      <ellipse cx="248" cy="492" rx="10" ry="7" fill="#f2a12e" />
      <g style={{ animation: "reel-chop 2.6s ease-in-out infinite" }}>
        <path d="M150 300 210 486M168 296 222 484" stroke="#d9b38c" strokeWidth="6" strokeLinecap="round" />
      </g>
    </Scene>
  );
}

function Die({ pips, style }: { pips: [number, number][]; style: CSSProperties }) {
  return (
    <g style={style}>
      <rect x="0" y="0" width="64" height="64" rx="12" fill="#fbfaf6" />
      {pips.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#1b1b1b" />
      ))}
    </g>
  );
}

function BoardGameScene() {
  const meeple = "M0 -26a9 9 0 0 1 9 9c0 3-1 5-3 7l16 6c3 1 4 4 3 7l-4 2-10-3 6 22H-15l6-22-10 3-4-2c-1-3 0-6 3-7l16-6c-2-2-3-4-3-7a9 9 0 0 1 9-9Z";
  return (
    <Scene
      defs={
        <radialGradient id="felt" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0" stopColor="#2f8a5e" />
          <stop offset="1" stopColor="#0d3b28" />
        </radialGradient>
      }
    >
      <rect width="390" height="844" fill="url(#felt)" />
      <rect x="40" y="610" width="92" height="128" rx="10" fill="#f0d9a8" style={{ animation: "reel-slide 5s ease-in-out infinite" }} />
      <rect x="250" y="250" width="92" height="128" rx="10" fill="#e9a6a6" transform="rotate(14 296 314)" />
      <rect x="262" y="640" width="92" height="128" rx="10" fill="#a9c8f0" transform="rotate(-10 308 704)" />
      {[
        { x: 90, y: 420, fill: "#f2c94c", delay: 0 },
        { x: 300, y: 470, fill: "#eb5757", delay: 0.4 },
        { x: 130, y: 560, fill: "#56ccf2", delay: 0.8 },
      ].map((piece) => (
        <g key={piece.fill} transform={`translate(${piece.x} ${piece.y})`}>
          <path d={meeple} fill={piece.fill} style={{ animation: `reel-hop 2.4s ease-in-out ${piece.delay}s infinite` }} />
        </g>
      ))}
      <g transform="translate(150 470)">
        <Die pips={[[16, 16], [32, 32], [48, 48]]} style={{ animation: "reel-tumble 3.2s cubic-bezier(0.3,0.7,0.4,1) infinite" }} />
      </g>
      <g transform="translate(222 500)">
        <Die pips={[[16, 16], [48, 16], [16, 48], [48, 48], [16, 32], [48, 32]]} style={{ animation: "reel-tumble2 3.2s cubic-bezier(0.3,0.7,0.4,1) infinite" }} />
      </g>
      {/* On-video text, the way a club's reel would caption itself. */}
      <g fontFamily="system-ui,-apple-system,sans-serif" fontWeight="800" fontSize="23" textAnchor="middle">
        <rect x="88" y="168" width="214" height="40" rx="8" fill="#ffffff" />
        <text x="195" y="196" fill="#0d3b28">board game night</text>
        <rect x="40" y="214" width="310" height="40" rx="8" fill="#f2c94c" />
        <text x="195" y="242" fill="#1b1b1b">tonight + free dumplings</text>
      </g>
    </Scene>
  );
}
