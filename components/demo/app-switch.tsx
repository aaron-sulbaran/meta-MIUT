"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MetaLockup } from "@/components/invite/meta-account";
import { switchFrom } from "@/lib/demo/app-switch";

export { APP_SWITCH_PARAM, withAppSwitch } from "@/lib/demo/app-switch";

// The visible hop from Instagram into Facebook, so the room sees an app change:
// a Facebook page opened from Instagram carries ?opened=instagram, and this plays
// Facebook's own launch screen (the official logo from public/brand, "from Meta")
// for about 1.2 s over the page, which renders underneath and is ready when it
// lifts. With reduced motion it holds still and fades. Nothing plays without the flag.
//
//   link:  withAppSwitch("/invite/abc?from=x")  ->  "/invite/abc?from=x&opened=instagram"
//   page:  <AppSwitch from={searchParams.opened}>{page}</AppSwitch>

export const APP_SWITCH_MS = 1_200;

const KEYFRAMES =
  // An app opening: the launch screen grows out of where the icon was, holds, then lifts.
  "@keyframes as-open{0%{opacity:1;transform:scale(.18);border-radius:48px}30%{opacity:1;transform:none;border-radius:0}83%{opacity:1}100%{opacity:0}}" +
  // The page waits under the launch screen until it covers the phone, so it never shows first and then hides.
  "@keyframes as-under{0%,29%{visibility:hidden}30%,100%{visibility:visible}}" +
  "@keyframes as-logo{0%,12%{opacity:0;transform:scale(.6)}34%{opacity:1;transform:scale(1.06)}44%,100%{opacity:1;transform:none}}" +
  "@keyframes as-still{0%,80%{opacity:1}100%{opacity:0}}" +
  "@keyframes as-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}";

export function AppSwitch({ from, children }: { from: string | string[] | undefined | null; children: ReactNode }) {
  const source = switchFrom(from);
  const [playing, setPlaying] = useState(source !== null);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), APP_SWITCH_MS);
    return () => window.clearTimeout(timer);
  }, [playing]);

  return (
    <>
      {/* Always the same wrapper (display: contents), so the page never remounts when the switch ends. */}
      <div className={playing ? "contents motion-safe:animate-[as-under_1200ms_step-end_both]" : "contents"}>{children}</div>
      {playing && (
        <div
          role="status"
          aria-label="Opening Facebook"
          // Timed in CSS too, so it lifts on time even before the page hydrates.
          className="pointer-events-none fixed inset-0 z-[100] mx-auto flex w-full max-w-[390px] flex-col items-center bg-white motion-safe:animate-[as-open_1200ms_cubic-bezier(.2,.8,.2,1)_both] motion-reduce:animate-[as-still_1200ms_linear_both]"
        >
          <style>{KEYFRAMES}</style>
          <div className="flex flex-1 flex-col items-center justify-center gap-[18px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the official logo file, drawn as is */}
            <img src="/brand/facebook-f.svg" alt="Facebook" width={84} height={84} className="h-[84px] w-[84px] motion-safe:animate-[as-logo_1200ms_ease-out_both]" />
            <p className="text-[15px] font-medium text-[#65676b]">Opening Facebook</p>
            <span aria-hidden className="h-[3px] w-[96px] overflow-hidden rounded-full bg-[#e4e6eb]">
              <span className="block h-full w-full origin-left rounded-full bg-[#0866ff] motion-safe:animate-[as-bar_1000ms_ease-in-out_both]" />
            </span>
          </div>
          <div className="flex flex-col items-center gap-[6px] pb-[max(34px,env(safe-area-inset-bottom))]">
            <span className="text-[13px] text-[#65676b]">from</span>
            <MetaLockup height={16} />
          </div>
        </div>
      )}
    </>
  );
}
