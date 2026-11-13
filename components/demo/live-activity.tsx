"use client";

import { useRouter } from "next/navigation";
import { StagedMark } from "@/components/demo/instagram";
import { MuseMark } from "@/components/ui/icons";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { FreeBite } from "@/lib/demo/free-bite";
import { handOff } from "@/lib/demo/staged";

// U1a: a phone's lock screen with a Live Activity from Muse, the moment Aaron
// walks out of class. Drawn for the demo (no system logos, a gradient instead of
// a photo); its words come from real data. One tap opens the map with the walk
// home planned.

function campus(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("en-US", { ...options, timeZone: CAMPUS_TIME_ZONE });
}

function Glyph({ d, className = "h-[22px] w-[22px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function LiveActivityLockScreen({
  nowIso,
  lastClass,
  bite,
  handoffPath,
}: {
  nowIso: string;
  lastClass: string | null;
  bite: FreeBite | null;
  handoffPath: string;
}) {
  const router = useRouter();
  const time = campus(nowIso, { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, "");
  const date = campus(nowIso, { weekday: "long", month: "long", day: "numeric" });
  const until = bite ? campus(bite.endsAt, { hour: "numeric", minute: "2-digit" }) : null;
  const headline = `${lastClass ? `Out of ${lastClass}.` : "Just out of class."} Want a free bite?`;

  return (
    <div
      aria-label="Staged lock screen with a Live Activity"
      className="fixed inset-y-0 left-1/2 z-40 flex w-full max-w-[390px] -translate-x-1/2 flex-col overflow-hidden text-white"
      style={{ background: "linear-gradient(165deg, #10204a 0%, #2b2a6b 45%, #6d3a7d 75%, #c76b6b 110%)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <style>{"@keyframes la-in{from{opacity:0;transform:translateY(14px) scale(0.98)}to{opacity:1;transform:none}}"}</style>
      <StagedMark />

      <div className="flex flex-col items-center pt-[max(64px,calc(env(safe-area-inset-top)+28px))]">
        <Glyph d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12v9H6Z" className="h-[18px] w-[18px] opacity-80" />
        <p className="mt-2 text-[18px] font-semibold opacity-90">{date}</p>
        <p className="text-[92px] font-semibold leading-[1] tracking-[-0.02em]">{time}</p>
      </div>

      <div className="mt-auto px-3 pb-3">
        <button
          type="button"
          onClick={() => handOff(handoffPath, router.push)}
          aria-label={`${headline} Open the walk home on the map`}
          className="w-full rounded-[24px] bg-black/45 p-4 text-left backdrop-blur-xl motion-safe:animate-[la-in_420ms_ease-out]"
        >
          <span className="flex items-center gap-2 text-[13px] text-white/70">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[#0866ff]">
              <MuseMark className="h-[15px] w-[15px] text-white" />
            </span>
            Muse · Facebook Events
            <span className="ml-auto">now</span>
          </span>
          <span className="mt-2 block text-[18px] font-semibold leading-[23px]">{headline}</span>
          {bite ? (
            <>
              <span className="mt-1 block text-[15px] leading-[20px] text-white/85">
                {bite.perk} at {bite.title}, {bite.walkMinutes} min walk, until {until}
              </span>
              <span className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-white/80" aria-hidden>
                <span className="h-[10px] w-[10px] rounded-full bg-[#4da3ff] ring-4 ring-[#4da3ff]/25" />
                <span className="h-[3px] flex-1 rounded-full bg-[#4da3ff]" />
                <span className="rounded-full bg-white/15 px-2 py-[2px]">{bite.perk}</span>
                <span className="h-[3px] flex-1 rounded-full bg-white/25" />
                <Glyph d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10" className="h-[15px] w-[15px]" />
              </span>
            </>
          ) : (
            <span className="mt-1 block text-[15px] leading-[20px] text-white/85">Muse is checking what is free on your way home.</span>
          )}
          <span className="mt-3 block text-[13px] text-white/60">Tap to see your walk home</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-12 pb-[max(14px,env(safe-area-inset-bottom))] pt-4" aria-hidden>
        <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-black/30 backdrop-blur">
          <Glyph d="M9 3h6l-1 6h-4ZM10 9h4v12h-4Z" />
        </span>
        <span className="mb-1 h-[5px] w-[134px] self-end rounded-full bg-white/80" />
        <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-black/30 backdrop-blur">
          <Glyph d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4ZM12 16.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
        </span>
      </div>
    </div>
  );
}
