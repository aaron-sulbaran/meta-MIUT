"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DrawnAvatar, IG, IgIcons, StagedScreen } from "@/components/demo/instagram";
import { MuseMark } from "@/components/ui/icons";
import { HANDOFF } from "@/lib/demo/staged";

// O1: the organizer finishes an Instagram post of their flyer. O2: on Share,
// the prompt that this looks like event promo and could be a Facebook event.
// Yes hands the flyer and caption to the real organizer flow (O3).

function Row({ label, value, toggle }: { label: string; value?: string; toggle?: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-[#efefef] px-4 py-[13px] text-[15px]">
      <span>{label}</span>
      {toggle !== undefined ? (
        <span aria-hidden className={`flex h-[26px] w-[44px] items-center rounded-full p-[2px] ${toggle ? "bg-black" : "bg-[#dbdbdb]"}`}>
          <span className={`h-[22px] w-[22px] rounded-full bg-white shadow ${toggle ? "translate-x-[18px]" : ""}`} />
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[14px]" style={{ color: IG.muted }}>
          {value}
          <span className="-rotate-90">{IgIcons.chevronDown("h-[14px] w-[14px]")}</span>
        </span>
      )}
    </div>
  );
}

export function InstagramNewPost({ handle, caption, flyerSrc, atIso }: { handle: string; caption: string; flyerSrc: string; atIso: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [shared, setShared] = useState(false);

  return (
    <StagedScreen label="Staged Instagram new post">
      <header className="flex h-[44px] shrink-0 items-center justify-between px-3">
        <span aria-hidden>{IgIcons.back()}</span>
        <h1 className="text-[16px] font-semibold">New post</h1>
        <span className="w-6" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-center bg-[#fafafa] py-3">
          {/* The drawn flyer, made at request time for the demo clock. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyerSrc} alt="The club's flyer: free dumplings and board games" className="h-[300px] w-[240px] rounded-[4px] object-cover shadow-sm" />
        </div>
        <div className="flex gap-3 px-4 py-3">
          <DrawnAvatar name={handle} size={30} />
          <p className="min-w-0 flex-1 text-[15px] leading-[20px]">{caption}</p>
        </div>
        <Row label="Tag people" value="" />
        <Row label="Add location" value="MIT Museum" />
        <Row label="Audience" value="Everyone" />
        <Row label="Share to other apps" toggle={false} />
      </div>

      <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="h-[44px] w-full rounded-[10px] text-[15px] font-semibold text-white"
          style={{ background: IG.blue }}
        >
          {shared ? "Shared" : "Share"}
        </button>
      </div>

      {asking && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={() => setAsking(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crosspost-title"
            onClick={(click) => click.stopPropagation()}
            className="w-full rounded-t-[18px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 motion-safe:animate-[staged-sheet-up_260ms_ease-out]"
          >
            <div className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-[#dbdbdb]" />
            <div className="flex items-start gap-3">
              <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] text-[#0866ff]">
                <MuseMark className="h-[24px] w-[24px]" />
              </span>
              <div className="min-w-0">
                <h2 id="crosspost-title" className="text-[17px] font-semibold leading-[22px]">
                  This looks like event promo. Post it to Facebook Events?
                </h2>
                <p className="mt-1 text-[14px] leading-[19px]" style={{ color: IG.muted }}>
                  Muse reads your post and makes the event: when, where, free food, and who can come. You check it before it goes live.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(`${HANDOFF.organizer}&at=${encodeURIComponent(atIso)}`)}
              className="mt-5 h-[44px] w-full rounded-[10px] text-[15px] font-semibold text-white"
              style={{ background: IG.blue }}
            >
              Post to Facebook Events
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                setShared(true);
              }}
              className="mt-1 h-[40px] w-full text-[15px] font-semibold"
            >
              Just share on Instagram
            </button>
          </div>
        </div>
      )}
    </StagedScreen>
  );
}
