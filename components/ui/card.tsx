import type { ReactNode } from "react";

/** A plain white panel with the app's hairline border. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-hairline bg-card p-3 ${className}`}>{children}</section>;
}

/** A quiet line saying whether Muse answered live or a recorded answer was shown. */
export function SourceBadge({ source }: { source: "muse" | "fixture" }) {
  return (
    <span className="text-[13px] font-semibold text-muted">
      {source === "muse" ? "Answered by Muse" : "Recorded answer"}
    </span>
  );
}

/** The thick grey rule Facebook puts between feed units. */
export function FeedSeparator() {
  return <div aria-hidden className="h-[2px] bg-separator/70" />;
}
