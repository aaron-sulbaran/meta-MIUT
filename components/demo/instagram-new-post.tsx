"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStageBeat } from "@/components/demo/phone-beat-sync";
import { CrossAppSheet, DrawnAvatar, IG, IgIcons, SheetGlyphs, StagedScreen } from "@/components/demo/instagram";
import { HANDOFF, handOff } from "@/lib/demo/staged";

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

export function InstagramNewPost({
  handle,
  organizerName,
  caption,
  flyerSrc,
  atIso,
}: {
  handle: string;
  /** The club's display name, as Instagram names the Facebook page it posts as. */
  organizerName: string;
  caption: string;
  flyerSrc: string;
  /** Set when the page was given a pinned clock (?at=), so the organizer flow uses the same one. */
  atIso: string | null;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [shared, setShared] = useState(false);
  // Share tapped on another phone (a presenter's own, or the laptop's keys): show O2's sheet here too.
  useStageBeat((id) => {
    if (id === "O2") setAsking(true);
    if (id === "O1") setAsking(false);
  });

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
          <img src={flyerSrc} alt="The club's flyer: free dumplings and board games" className="h-[300px] w-[240px] rounded-[4px] object-cover outline outline-1 -outline-offset-1 outline-black/10" />
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
          onClick={() => {
            // On the /demo stage, Share is O1's tap: the prompt is O2, on this same screen.
            setAsking(true);
            handOff(HANDOFF.instagramPost(atIso), () => undefined);
          }}
          className="h-[44px] w-full rounded-[12px] text-[15px] font-bold text-white"
          style={{ background: IG.blue }}
        >
          {shared ? "Shared" : "Share"}
        </button>
      </div>

      {asking && (
        <CrossAppSheet
          titleId="crosspost-title"
          title="Post this to Facebook Events?"
          rows={[
            {
              glyph: SheetGlyphs.facebook,
              detail: (
                <>
                  Muse turns this post into a Facebook event as <strong className="font-bold text-black">{organizerName}</strong>. You check it before it goes live.
                </>
              ),
            },
            {
              glyph: SheetGlyphs.globe,
              lead: "Audience: Public",
              detail: "Anyone on Facebook can find the event, mark Interested, and invite friends.",
            },
          ]}
          action="Post to Facebook Events"
          onAction={() => handOff(HANDOFF.organizerAt(atIso), router.push)}
          decline="Share this post only"
          onDecline={() => {
            setAsking(false);
            setShared(true);
          }}
        />
      )}
    </StagedScreen>
  );
}
