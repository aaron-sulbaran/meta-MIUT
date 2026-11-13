"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DrawnAvatar, IG, IgIcons, IgTabBar, StagedScreen } from "@/components/demo/instagram";
import { CloseIcon } from "@/components/ui/icons";
import { HANDOFF } from "@/lib/demo/staged";

// U3a: an Instagram feed where a club User 3 follows posted the event. A
// prompt at the bottom, in the style of Instagram's own nudges, offers to
// check it out on Facebook Events; yes opens the curate step (U3b).

const STORIES = ["your story", "maya.codes", "leo_films", "priya.climbs", "sam.econ", "kai_beats"];

export function InstagramFeed({ handle, caption, flyerSrc }: { handle: string; caption: string; flyerSrc: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(false);

  // The nudge slides up a moment after the post is on screen, as Instagram's do.
  useEffect(() => {
    const timer = setTimeout(() => setPrompt(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <StagedScreen label="Staged Instagram feed">
      <header className="flex h-[44px] shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-1 text-[20px] font-semibold tracking-[-0.01em]">
          For you {IgIcons.chevronDown()}
        </span>
        <span className="flex items-center gap-5">
          {IgIcons.heart()}
          {IgIcons.send()}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul aria-hidden className="no-scrollbar flex gap-[14px] overflow-x-auto px-3 pb-3 pt-1">
          {STORIES.map((name, index) => (
            <li key={name} className="flex w-[66px] shrink-0 flex-col items-center gap-1">
              <DrawnAvatar name={name} size={58} ring={index > 0} seen={index > 3} />
              <span className="w-full truncate text-center text-[11px]">{name}</span>
            </li>
          ))}
        </ul>

        <article className="border-t border-[#efefef]">
          <div className="flex items-center gap-[10px] px-3 py-[10px]">
            <DrawnAvatar name={handle} size={32} ring />
            <div className="min-w-0 flex-1 leading-[16px]">
              <p className="text-[14px] font-semibold">{handle}</p>
              <p className="text-[12px]">MIT Museum</p>
            </div>
            {IgIcons.more()}
          </div>
          {/* The drawn flyer for the demo clock. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyerSrc} alt="Flyer: free dumplings and board games at the MIT Museum" className="aspect-[4/5] w-full object-cover" />
          <div className="flex items-center gap-4 px-3 pt-[10px]">
            {IgIcons.heart()}
            {IgIcons.comment()}
            {IgIcons.send()}
            <span className="ml-auto">{IgIcons.save()}</span>
          </div>
          <p className="px-3 pt-2 text-[14px] font-semibold">218 likes</p>
          <p className="px-3 pt-1 text-[14px] leading-[18px]">
            <span className="font-semibold">{handle}</span> {caption}
          </p>
          <p className="px-3 pb-4 pt-1 text-[12px]" style={{ color: IG.muted }}>
            25 minutes ago
          </p>
        </article>
      </div>

      {prompt && (
        <div
          role="dialog"
          aria-labelledby="events-nudge-title"
          className="absolute inset-x-2 bottom-[calc(max(12px,env(safe-area-inset-bottom))+52px)] z-10 rounded-[16px] border border-[#efefef] bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,0.18)] motion-safe:animate-[staged-pop_240ms_ease-out]"
        >
          <button type="button" onClick={() => setPrompt(false)} aria-label="Not now" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full" style={{ color: IG.muted }}>
            <CloseIcon className="h-[13px] w-[13px]" />
          </button>
          <h2 id="events-nudge-title" className="pr-6 text-[16px] font-semibold leading-[21px]">
            Check this out on Facebook Events?
          </h2>
          <p className="mt-1 text-[14px] leading-[19px]" style={{ color: IG.muted }}>
            See who&apos;s going, what else is on near you today, and get there. You already have a Facebook account.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => router.push(HANDOFF.curate)}
              className="h-[38px] flex-1 rounded-[10px] text-[14px] font-semibold text-white"
              style={{ background: IG.blue }}
            >
              Open Facebook Events
            </button>
            <button type="button" onClick={() => setPrompt(false)} className="h-[38px] rounded-[10px] bg-[#efefef] px-4 text-[14px] font-semibold">
              Not now
            </button>
          </div>
        </div>
      )}

      <IgTabBar />
    </StagedScreen>
  );
}
