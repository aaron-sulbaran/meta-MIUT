"use client";

import { useEffect, useId, useState } from "react";
import { MuseMark } from "@/components/ui/icons";

// One Muse button at the top right of the map (Lisa's design, hub t-94t4). It
// shows Sprout, the Muse character (a Blender render), and fans out into two
// translucent options while Sprout turns toward them: Ask Muse (a popup over
// the map with the Ask bar) and Food crawl (the crawl planner sheet).

export const SPROUT_SRC = "/muse/sprout.png";

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

  // Escape closes the fan.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const options = [
    { label: "Ask Muse", hint: "Type or say it", Icon: MuseMark, run: onAsk },
    { label: "Food crawl", hint: "Free stops on your walk", Icon: RouteGlyph, run: onCrawl },
  ];

  return (
    <>
      {open && <button type="button" aria-label="Close the Muse menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 z-20 cursor-default bg-ink/10" />}
      <div className="absolute right-3 top-[54px] z-30 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close Muse" : "Muse: ask or plan a food crawl"}
          className="relative flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-full bg-card shadow-md ring-1 ring-black/5 transition-transform active:scale-95"
        >
          <span
            className="block transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] motion-reduce:transition-none"
            style={{ transform: open ? "rotate(-14deg) translate(-2px, 2px)" : "none" }}
          >
            <MuseFace size={50} className="scale-[1.18]" />
          </span>
        </button>

        <ul
          id={menuId}
          role="menu"
          aria-label="Muse"
          className="mt-[10px] flex flex-col items-end gap-[8px]"
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
                className="flex items-center gap-[10px] rounded-full bg-card/75 py-[7px] pl-[8px] pr-[14px] text-left shadow-md ring-1 ring-black/5 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
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
