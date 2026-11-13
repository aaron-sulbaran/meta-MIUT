"use client";

import { AskBar, type AskPlan } from "@/components/ask/ask-bar";
import { MuseFace } from "@/components/map/muse-menu";
import { CloseIcon } from "@/components/ui/icons";
import type { CampusEvent } from "@/lib/events/schema";

// Ask Muse as a popup over the map, not a new page: Jing's Ask bar (type or
// tap the mic), with a plan ("plan my night", "I'm meeting Lisa instead")
// handed back to the map to draw as a route.

export function MapAsk({
  events,
  nowIso,
  onPlan,
  onClose,
}: {
  events: CampusEvent[];
  nowIso: string;
  onPlan: (plan: AskPlan, question: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Ask Muse"
      className="absolute inset-x-2 top-[54px] z-30 flex max-h-[calc(100%-54px-var(--tabbar-height)-var(--tabbar-gap)-24px)] flex-col overflow-hidden rounded-[20px] bg-card/95 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/5 backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center gap-[10px] px-3 pt-3">
        <span className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded-full bg-card ring-1 ring-black/5">
          <MuseFace size={38} className="scale-[1.18]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title font-bold leading-[19px]">Ask Muse</h2>
          <p className="text-meta font-semibold text-muted">Say where you are headed. Muse draws it on the map.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Ask Muse" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wash">
          <CloseIcon className="h-[14px] w-[14px]" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto pb-3 [&>section]:px-3">
        <AskBar events={events} nowIso={nowIso} placeholder="I'm meeting Lisa, find free food on the way" onPlan={onPlan} />
      </div>
    </div>
  );
}
