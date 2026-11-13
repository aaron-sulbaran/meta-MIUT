import type { ReactNode } from "react";

// Shared pieces of the staged Instagram screens (hub t-y329). They read as
// Instagram by layout alone: no logo, no wordmark, invented names, drawn
// avatars. Each screen fills the phone frame and says quietly that it is staged.

export const IG = {
  ink: "#000000",
  muted: "#737373",
  line: "#dbdbdb",
  // Instagram's current action blue, sampled from its own share sheet.
  blue: "#4f5cf9",
  bubble: "#efefef",
  ring: "linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)",
} as const;

const TINTS = ["#ffd6c9", "#d6e8ff", "#e1f3d8", "#f3dcff", "#fff1c2", "#d7f4f2"];

/** A drawn avatar: initials on a soft tint, with Instagram's story ring when `ring` is set. */
export function DrawnAvatar({ name, size, ring = false, seen = false }: { name: string; size: number; ring?: boolean; seen?: boolean }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const initials = name
    .split(/[\s_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  const face = (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full font-semibold text-[#3a3a3a]"
      style={{ width: size, height: size, background: TINTS[hash % TINTS.length], fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
  if (!ring) return face;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full p-[2px]" style={{ background: seen ? IG.line : IG.ring }}>
      <span className="flex rounded-full bg-white p-[2px]">{face}</span>
    </span>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IgIcons = {
  heart: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.2-7.5 10.2Z" />
    </svg>
  ),
  comment: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.5-4.4a8.4 8.4 0 1 1 15.5-4.5Z" />
    </svg>
  ),
  send: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M21 3.5 10.2 13.8M21 3.5l-6.6 17-4.2-6.7-6.7-4.2 17.5-6.1Z" />
    </svg>
  ),
  save: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M18.5 20.5 12 15l-6.5 5.5V4.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1Z" />
    </svg>
  ),
  home: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 3.2 3 10.4V21h6.3v-6h5.4v6H21V10.4Z" />
    </svg>
  ),
  reels: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M3.5 8.5h17M9 3.5l2.5 5M15 3.5l2.5 5M10.5 12v5l4.2-2.5Z" />
    </svg>
  ),
  search: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  ),
  plus: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  back: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke} strokeWidth={2.2}>
      <path d="M15 4.5 7.5 12l7.5 7.5" />
    </svg>
  ),
  chevronDown: (className = "h-4 w-4") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke} strokeWidth={2.4}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  more: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  ),
  phone: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M7.5 3.5h-2a2 2 0 0 0-2 2.1C3.9 14 10 20.1 18.4 20.5a2 2 0 0 0 2.1-2v-2.1l-4.2-1.6-2 2a12 12 0 0 1-5.1-5.1l2-2-1.7-4.2Z" />
    </svg>
  ),
  video: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="m15.5 10.5 5.5-3.2v9.4l-5.5-3.2" />
    </svg>
  ),
  camera: (className = "h-5 w-5") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  ),
  mic: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  ),
  photo: (className = "h-6 w-6") => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-5-5-8.5 8.5" />
    </svg>
  ),
};

/** A staged screen covers the phone frame (Facebook's chrome is hidden on these routes). */
export function StagedScreen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      aria-label={label}
      className="fixed inset-y-0 left-1/2 z-40 flex w-full max-w-[390px] -translate-x-1/2 flex-col overflow-hidden bg-white pt-[max(44px,env(safe-area-inset-top))] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-black"
    >
      <style>{"@keyframes staged-sheet-up{from{transform:translateY(100%)}to{transform:none}}@keyframes staged-pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>
      {children}
      <StagedMark />
    </div>
  );
}

/** Honest but quiet: these screens imitate another app for the demo. */
export function StagedMark() {
  return (
    <span className="pointer-events-none absolute right-[8px] top-[max(14px,calc(env(safe-area-inset-top)-30px))] rounded-[6px] border border-dashed border-[#c7c7c7] bg-white/85 px-[6px] py-[1px] text-[10px] font-medium text-[#8e8e8e]">
      Staged for the demo
    </span>
  );
}

/** Outline glyphs for the sheet rows, drawn (no logo files). */
export const SheetGlyphs = {
  facebook: (
    <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M13.4 21.2v-7.4h2.3l.4-2.7h-2.7V9.4c0-.8.4-1.4 1.5-1.4h1.3V5.7a15 15 0 0 0-2-.2c-2.1 0-3.4 1.2-3.4 3.5v2.1H8.5v2.7h2.3v7.4" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M2.75 12h18.5M12 2.75c2.4 2.5 3.6 5.6 3.6 9.25S14.4 18.75 12 21.25M12 2.75C9.6 5.25 8.4 8.35 8.4 12s1.2 6.75 3.6 9.25" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" aria-hidden {...stroke}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.75 20c.6-3.4 3.1-5.5 6.25-5.5s5.65 2.1 6.25 5.5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.3 2.5 3.75 5.2" />
    </svg>
  ),
};

export type SheetRow = { glyph: ReactNode; lead?: ReactNode; detail: ReactNode };

/**
 * Instagram's cross-app prompt, drawn from its real "Always share reels on
 * Facebook?" sheet: grabber, a bold two line question, outline-icon rows with a
 * bold lead and grey detail, one wide blue button, one blue text button.
 */
export function CrossAppSheet({
  titleId,
  title,
  rows,
  action,
  onAction,
  decline,
  onDecline,
}: {
  titleId: string;
  title: ReactNode;
  rows: SheetRow[];
  action: string;
  onAction: () => void;
  decline: string;
  onDecline: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/45" onClick={onDecline}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(click) => click.stopPropagation()}
        className="w-full rounded-t-[28px] bg-white px-[30px] pb-[max(14px,env(safe-area-inset-bottom))] pt-[10px] motion-safe:animate-[staged-sheet-up_280ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <div className="mx-auto h-[3px] w-[34px] rounded-full bg-[#c7c7cc]" />
        <h2 id={titleId} className="mt-[34px] max-w-[290px] text-[24px] font-extrabold leading-[28px] tracking-[-0.01em] [text-wrap:balance]">
          {title}
        </h2>
        <ul className="mt-[26px] flex flex-col gap-[22px]">
          {rows.map((row, index) => (
            <li key={index} className="flex gap-[14px]">
              <span className="mt-[1px] shrink-0">{row.glyph}</span>
              <p className="text-[15px] leading-[19px] [text-wrap:pretty]">
                {row.lead && <span className="block font-bold">{row.lead}</span>}
                <span style={{ color: row.lead ? IG.muted : IG.ink }}>{row.detail}</span>
              </p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onAction}
          className="mt-[30px] h-[44px] w-full rounded-[12px] text-[15px] font-bold text-white"
          style={{ background: IG.blue }}
        >
          {action}
        </button>
        <button type="button" onClick={onDecline} className="mt-[4px] h-[44px] w-full text-[15px] font-bold" style={{ color: IG.blue }}>
          {decline}
        </button>
      </div>
    </div>
  );
}

/** Instagram's bottom bar, drawn; inert. */
export function IgTabBar() {
  return (
    <nav aria-hidden className="flex shrink-0 items-center justify-around border-t border-[#efefef] bg-white pb-[max(12px,env(safe-area-inset-bottom))] pt-[10px] text-black">
      {IgIcons.home()}
      {IgIcons.reels()}
      {IgIcons.send()}
      {IgIcons.search()}
      <DrawnAvatar name="me" size={26} />
    </nav>
  );
}
