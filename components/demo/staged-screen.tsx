"use client";

import type { StagedScreen } from "@/lib/demo/beats";

// Screens that imitate another app (Instagram, a message), shown only on the
// /demo stage. Placeholders until t-y329 draws each one; every screen ends in
// one tap that hands off into the real app.

const PLACEHOLDER_COPY: Record<StagedScreen, { app: string; line: string; action: string }> = {
  "instagram-new-post": { app: "Instagram", line: "New post: the club's flyer and caption", action: "Share" },
  "instagram-crosspost-prompt": {
    app: "Instagram",
    line: "This looks like event promo. Post it to Facebook Events?",
    action: "Post to Facebook Events",
  },
  "live-activity": { app: "Lock Screen", line: "Out of class. Want a free bite?", action: "Show me" },
  "invite-message": { app: "Messages", line: "Jolyn's Muse: come to Board Game Night + Free Dumplings with me?", action: "Open the event" },
  "instagram-feed-prompt": {
    app: "Instagram",
    line: "A club you follow posted an event. Check it out on Facebook Events?",
    action: "Open Facebook Events",
  },
};

export function StagedScreenView({ screen, onHandoff }: { screen: StagedScreen; onHandoff: () => void }) {
  const copy = PLACEHOLDER_COPY[screen];
  return (
    <div className="flex h-full flex-col bg-card text-ink">
      <div className="flex h-[52px] items-center border-b border-hairline px-4 font-display text-[20px] font-bold">{copy.app}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <p className="font-display text-[22px] leading-[28px] font-bold">{copy.line}</p>
        <p className="text-body text-muted">Staged screen, drawn for the demo only.</p>
        <button
          type="button"
          onClick={onHandoff}
          className="h-[44px] rounded-button bg-primary px-5 font-display text-label font-bold text-on-primary"
        >
          {copy.action}
        </button>
      </div>
    </div>
  );
}
