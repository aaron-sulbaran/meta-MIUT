import type { ReactNode } from "react";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { PhoneChrome } from "@/lib/demo/phone-chrome";

// The phone drawn on the /demo stage: an iPhone shaped screen (390 by 844
// points, display corners of about 47 points) in a dark bezel, with a status
// bar in the top safe area and a home indicator at the bottom. Everything is
// drawn at phone size and scaled as one piece, so the corners and the bezel
// look the same at every window size.
//
// An inset screen (lib/demo/phone-chrome.ts) gets the area below the status
// bar, like an app given iOS's top safe area; a full bleed screen fills the
// glass and the bar sits over it. The home indicator floats over the bottom of
// either, as on iOS.

export const SCREEN_WIDTH = 390;
export const SCREEN_HEIGHT = 844;
const SCREEN_RADIUS = 47;
const BEZEL = 12;
export const STATUS_BAR_HEIGHT = 47;
export const PHONE_OUTER_WIDTH = SCREEN_WIDTH + BEZEL * 2;
export const PHONE_OUTER_HEIGHT = SCREEN_HEIGHT + BEZEL * 2;

/** The app area a screen gets, in phone points. */
export function appArea(chrome: PhoneChrome): { top: number; height: number } {
  return chrome.layout === "inset"
    ? { top: STATUS_BAR_HEIGHT, height: SCREEN_HEIGHT - STATUS_BAR_HEIGHT }
    : { top: 0, height: SCREEN_HEIGHT };
}

function statusTime(at: Date): string {
  return at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE }).replace(/\s?[AP]M$/, "");
}

function StatusBar({ chrome, time }: { chrome: PhoneChrome; time: Date }) {
  const ink = chrome.tone === "light" ? "#ffffff" : "#000000";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[34px] pt-[3px]"
      style={{
        height: STATUS_BAR_HEIGHT,
        color: ink,
        background: chrome.layout === "inset" ? chrome.background : "transparent",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <span className="w-[54px] text-center text-[17px] leading-none font-semibold tracking-[-0.02em]">{chrome.showTime ? statusTime(time) : ""}</span>
      <span className="flex items-center gap-[6px]">
        {/* Cellular signal: four bars. */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        {/* Wi-Fi: three arcs over a dot. */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M1.2 4.4a10 10 0 0 1 13.6 0" />
          <path d="M3.6 7a6.4 6.4 0 0 1 8.8 0" />
          <path d="M8 11.2 6 9.3a2.9 2.9 0 0 1 4 0Z" fill="currentColor" stroke="none" />
        </svg>
        {/* Battery, mostly full. */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="17" height="9" rx="2.4" fill="currentColor" />
          <path d="M25 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

export function PhoneFrame({
  scale,
  chrome,
  time,
  children,
}: {
  /** Window pixels per phone point. */
  scale: number;
  chrome: PhoneChrome;
  /** The time the status bar shows (the demo clock). */
  time: Date;
  /** The screens, absolutely positioned to fill the app area. */
  children: ReactNode;
}) {
  const area = appArea(chrome);
  const outerRadius = SCREEN_RADIUS + BEZEL;
  return (
    <div
      data-phone
      className="relative shrink-0"
      style={{
        width: PHONE_OUTER_WIDTH * scale,
        height: PHONE_OUTER_HEIGHT * scale,
        borderRadius: outerRadius * scale,
        boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="absolute top-0 left-0 overflow-clip bg-[#1c1e21]"
        style={{
          width: PHONE_OUTER_WIDTH,
          height: PHONE_OUTER_HEIGHT,
          padding: BEZEL,
          borderRadius: outerRadius,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          data-phone-screen
          data-radius={SCREEN_RADIUS}
          className="relative overflow-clip"
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, borderRadius: SCREEN_RADIUS, background: chrome.background }}
        >
          <div className="absolute inset-x-0" style={{ top: area.top, height: area.height }}>
            {children}
          </div>
          <StatusBar chrome={chrome} time={time} />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[8px] left-1/2 z-10 h-[5px] w-[134px] -translate-x-1/2 rounded-full"
            style={{ background: chrome.tone === "light" ? "#ffffff" : "#000000" }}
          />
        </div>
      </div>
    </div>
  );
}
