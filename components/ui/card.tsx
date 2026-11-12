import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${className}`}>{children}</section>;
}

export function SourceBadge({ source }: { source: "muse" | "fixture" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        source === "muse" ? "bg-primary-soft text-primary" : "bg-wash text-muted"
      }`}
    >
      {source === "muse" ? "Answered by Muse" : "Recorded fixture"}
    </span>
  );
}
