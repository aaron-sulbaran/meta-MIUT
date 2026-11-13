"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { MuseMark } from "@/components/ui/icons";

// Sprout, the Muse character (a Blender render), sits in the Events header
// where the search icon was, as a full body with no circle (Lisa, hub t-94t4).
// On the map, tapping Sprout fans out two translucent options while Sprout
// turns toward them: Ask Muse (a popup over the map with the Ask bar) and Food
// crawl (the crawl planner sheet). On the List view, Sprout opens Ask Muse.
// The header button and the map's menu talk through two window events.

export const SPROUT_SRC = "/muse/sprout.png";
/** Sprout's full body on a transparent background, from sprout-portrait in muse-friends. */
export const SPROUT_BODY_SRC = "/muse/sprout-body.png";

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
export function MuseBody({ size, className = "" }: { size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SPROUT_BODY_SRC}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`block select-none object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Sprout in the Events header. On the map it opens the Muse menu; on the List
 * view (mode "link") it goes to Ask Muse, as the search icon did.
 */
export function MuseHeaderButton({ mode }: { mode: "menu" | "link" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onState = (event: Event) => setOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener(MUSE_STATE, onState);
    return () => window.removeEventListener(MUSE_STATE, onState);
  }, []);

  const box = "flex h-[44px] w-[44px] items-center justify-center transition-transform active:scale-95";
  const body = (
    <span
      className="block transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] motion-reduce:transition-none"
      style={{ transform: open ? "rotate(-14deg) translate(-2px, 2px)" : "none" }}
    >
      <MuseBody size={38} />
    </span>
  );
  if (mode === "link") {
    return (
      <Link href="/ask" aria-label="Ask Muse" className={box}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(MUSE_TOGGLE))}
      aria-expanded={open}
      aria-label={open ? "Close Muse" : "Muse: ask or plan a food crawl"}
      className={box}
    >
      {body}
    </button>
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
    { label: "Ask Muse", hint: "Type or say it", Icon: MuseMark, run: onAsk },
    { label: "Food crawl", hint: "Plan your walk", Icon: RouteGlyph, run: onCrawl },
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
