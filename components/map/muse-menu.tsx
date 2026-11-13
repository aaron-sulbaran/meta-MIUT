"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

// Sprout, the Muse character (a Blender render), sits in the Events header
// where the search icon was, as a full body with no circle (Lisa, hub t-94t4).
// On the map, tapping Sprout fans out two translucent options while Sprout
// turns toward them: Ask Muse (a popup over the map with the Ask bar) and Food
// crawl (the crawl planner sheet). On the List view, Sprout opens Ask Muse.
// The header button and the map's menu talk through two window events.

export const SPROUT_SRC = "/muse/sprout.png";
/** Sprout's full body on a transparent background, from sprout-portrait in muse-friends. */
export const SPROUT_BODY_SRC = "/muse/sprout-body.png";
/** Sprout waving, on a loop that never stops (Lisa's GIF, cut out to a transparent animated WebP), so he stands out as the thing to tap. */
export const SPROUT_WAVE_SRC = "/muse/sprout-wave.webp";
/** The wave's first frame, for viewers who ask for less motion. */
export const SPROUT_WAVE_STILL_SRC = "/muse/sprout-wave-still.png";
// Set once Sprout has introduced himself, so the speech bubble shows only on a first visit.
const INTRO_SEEN_KEY = "muse:intro-seen";

const MUSE_TOGGLE = "muse:toggle";
const MUSE_STATE = "muse:state";

/** Sprout, the Muse character, as a round face. */
export function MuseFace({ size, className = "" }: { size: number; className?: string }) {
  return (
    // A small local render; a plain img keeps it simple and sharp.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SPROUT_SRC}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`block select-none rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Sprout's whole body, no circle or background. */
export function MuseBody({ size, className = "", animated = false }: { size: number; className?: string; animated?: boolean }) {
  // If the wave cannot load (a dev server that has not picked up the new file,
  // a stale deploy, an old browser), Sprout falls back to his still body
  // rather than a broken-image icon.
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // An error before hydration fires no onError, so check once on mount.
    const image = ref.current;
    if (image && image.complete && image.naturalWidth === 0) setFailed(true);
  }, []);
  const wave = animated && !failed;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={wave ? SPROUT_WAVE_SRC : SPROUT_BODY_SRC}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={wave ? () => setFailed(true) : undefined}
      className={`block select-none object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
  if (!wave) return img;
  // The wave plays nonstop unless the viewer asked for less motion.
  return (
    <picture>
      <source srcSet={SPROUT_WAVE_STILL_SRC} media="(prefers-reduced-motion: reduce)" />
      {img}
    </picture>
  );
}

/** The official Meta symbol (from the Meta lockup in muse-friends), for Ask Muse. */
function MetaGlyph({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/meta-symbol.png" alt="" aria-hidden draggable={false} className={`object-contain ${className ?? ""}`} />
  );
}

function readIntroSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage can be blocked; the bubble may show again next visit.
  }
}

/**
 * Sprout in the Events header. On the map it opens the Muse menu; on the List
 * view (mode "link") it goes to Ask Muse, as the search icon did.
 */
export function MuseHeaderButton({ mode }: { mode: "menu" | "link" }) {
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    const onState = (event: Event) => setOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(MUSE_STATE, onState);
    return () => window.removeEventListener(MUSE_STATE, onState);
  }, []);

  // First visit: Sprout introduces himself in a speech bubble for a few seconds.
  useEffect(() => {
    if (readIntroSeen()) return;
    const show = window.setTimeout(() => setIntro(true), 900);
    const hide = window.setTimeout(() => {
      setIntro(false);
      markIntroSeen();
    }, 8000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);
  const dismissIntro = () => {
    setIntro(false);
    markIntroSeen();
  };

  const box = "flex h-[44px] w-[44px] items-center justify-center transition-transform active:scale-95";
  const body = (
    <span
      className="block transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] motion-reduce:transition-none"
      style={{ transform: open ? "rotate(-14deg) translate(-2px, 2px)" : "none" }}
    >
      {/* Sprout waves the whole time, menu open or not, so he reads as
          someone to tap, not decoration. */}
      <MuseBody size={40} animated />
    </span>
  );
  const bubble = intro && !open && (
    <span
      role="status"
      className="pointer-events-none absolute right-0 top-[48px] z-50 w-[196px] rounded-[14px] bg-ink px-[12px] py-[9px] text-left text-[12.5px] font-semibold leading-[16px] text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
    >
      <span aria-hidden className="absolute -top-[5px] right-[16px] h-[11px] w-[11px] rotate-45 rounded-[2px] bg-ink" />
      {mode === "menu" ? "Hi, I'm Muse! Tap me to ask anything or plan a food crawl." : "Hi, I'm Muse! Tap me to ask anything."}
    </span>
  );
  if (mode === "link") {
    return (
      <span className="relative">
        <Link href="/ask" aria-label="Ask Muse" className={box} onClick={dismissIntro}>
          {body}
        </Link>
        {bubble}
      </span>
    );
  }
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => {
          dismissIntro();
          window.dispatchEvent(new Event(MUSE_TOGGLE));
        }}
        aria-expanded={open}
        aria-label={open ? "Close Muse" : "Muse: ask or plan a food crawl"}
        className={box}
      >
        {body}
      </button>
      {bubble}
    </span>
  );
}

function RouteGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
    </svg>
  );
}

export function MuseMenu({ onAsk, onCrawl }: { onAsk: () => void; onCrawl: () => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Sprout in the header opens and closes this menu; tell it whether it is open.
  useEffect(() => {
    const onToggle = () => setOpen((value) => !value);
    window.addEventListener(MUSE_TOGGLE, onToggle);
    return () => {
      window.removeEventListener(MUSE_TOGGLE, onToggle);
      window.dispatchEvent(new CustomEvent(MUSE_STATE, { detail: false }));
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MUSE_STATE, { detail: open }));
  }, [open]);

  // Escape closes the fan.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const options = [
    { label: "Ask Muse", hint: "Type or say it", Icon: MetaGlyph, run: onAsk },
    { label: "Food Crawl", hint: "Plan your walk", Icon: RouteGlyph, run: onCrawl },
  ];

  return (
    <>
      {open && <button type="button" aria-label="Close the Muse menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 z-20 cursor-default bg-ink/10" />}
      <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col items-end">
        <ul
          id={menuId}
          role="menu"
          aria-label="Muse"
          className="flex flex-col items-stretch gap-[8px]"
          style={{ pointerEvents: open ? "auto" : "none" }}
        >
          {options.map(({ label, hint, Icon, run }, index) => (
            <li key={label} role="none">
              <button
                type="button"
                role="menuitem"
                aria-label={label}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  run();
                }}
                className="flex w-full items-center gap-[10px] rounded-full bg-card/75 py-[7px] pl-[8px] pr-[14px] text-left shadow-md ring-1 ring-black/5 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : `translate(10px, -${14 + index * 18}px) scale(0.85)`,
                  transitionDelay: open ? `${index * 50}ms` : "0ms",
                }}
              >
                <span className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block font-display text-label font-bold leading-[17px] text-ink">{label}</span>
                  <span className="block text-meta font-semibold text-muted">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
