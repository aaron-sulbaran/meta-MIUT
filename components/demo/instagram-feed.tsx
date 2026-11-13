"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CrossAppSheet, DrawnAvatar, IG, IgIcons, IgTabBar, SheetGlyphs, StagedScreen } from "@/components/demo/instagram";
import { HANDOFF, handOff } from "@/lib/demo/staged";

// U3a: an Instagram feed where a club User 3 follows posted the event. A
// sheet, the same shape as Instagram's own cross-app prompts, offers to
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
        <CrossAppSheet
          titleId="events-nudge-title"
          title="Check this out on Facebook Events?"
          rows={[
            {
              glyph: SheetGlyphs.facebook,
              detail: (
                <>
                  Open <strong className="font-bold text-black">{handle}</strong>&apos;s event on Facebook. You already have a Facebook account, so there is nothing to sign up for.
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
          onAction={() => handOff(HANDOFF.curateAuto, router.push)}
          decline="Not now"
          onDecline={() => setPrompt(false)}
        />
      )}

      <IgTabBar />
    </StagedScreen>
  );
}
