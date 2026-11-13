import type { ReactNode } from "react";

// Drawn pieces of Meta's account surfaces, after Aaron's references in the
// hub (kb/meta-accounts-reference): the Meta lockup, round profile pictures
// with a small app badge at the lower right, and Accounts Center rows. All
// drawn here: no logo files and no real photos.

export const META_SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";

/** The Meta lockup: a drawn loop and the word, small and blue like Meta's sheets. */
export function MetaLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[5px] ${className}`}>
      <svg viewBox="0 0 24 14" aria-hidden className="h-[13px] w-[22px]" fill="none">
        <defs>
          <linearGradient id="meta-loop" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0081fb" />
            <stop offset="1" stopColor="#0064e0" />
          </linearGradient>
        </defs>
        <path
          d="M2 7c0-2.9 1.5-5 3.6-5 2.5 0 4.2 3.2 6.4 6.6C14.1 11.9 15.8 12 16.8 12c2 0 3.2-2 3.2-5s-1.3-5-3.2-5C14.8 2 13 4.5 12 7c-1.2 2.9-3.1 5-5.4 5C4 12 2 9.9 2 7Z"
          stroke="url(#meta-loop)"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#1c2b33]">Meta</span>
    </span>
  );
}

const FACES: Record<string, string> = {
  L: "linear-gradient(140deg, #ffd3b6 0%, #f6a28b 55%, #d97a6c 100%)",
  A: "linear-gradient(140deg, #c9e4ff 0%, #8fb8f2 55%, #5b86d6 100%)",
};

/** A drawn profile picture: a warm gradient with the person's initial. */
export function ProfileCircle({ name, size, badge, className = "" }: { name: string; size: number; badge?: "instagram" | "facebook"; className?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white ring-[3px] ring-white"
        style={{ background: FACES[initial] ?? FACES.A, fontSize: Math.round(size * 0.4) }}
      >
        {initial}
      </span>
      {badge && (
        <span className="absolute -right-[2px] -bottom-[2px]">
          <AppBadge app={badge} size={Math.max(18, Math.round(size * 0.34))} />
        </span>
      )}
    </span>
  );
}

/** A small app badge, drawn: Instagram's gradient square or Facebook's blue circle. */
export function AppBadge({ app, size }: { app: "instagram" | "facebook"; size: number }) {
  if (app === "facebook") {
    return (
      <span
        aria-label="Facebook"
        className="flex items-center justify-center rounded-full bg-[#0866ff] font-bold text-white ring-2 ring-white"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.72), lineHeight: 1, paddingTop: Math.round(size * 0.12) }}
      >
        f
      </span>
    );
  }
  return (
    <span
      aria-label="Instagram"
      className="flex items-center justify-center rounded-[30%] ring-2 ring-white"
      style={{ width: size, height: size, background: "linear-gradient(45deg, #feda75, #fa7e1e 30%, #d62976 60%, #962fbf 85%, #4f5bd5)" }}
    >
      <svg viewBox="0 0 16 16" aria-hidden style={{ width: size * 0.62, height: size * 0.62 }} fill="none" stroke="white" strokeWidth="1.7">
        <rect x="2" y="2" width="12" height="12" rx="3.6" />
        <circle cx="8" cy="8" r="2.9" />
        <circle cx="11.6" cy="4.4" r="0.6" fill="white" stroke="none" />
      </svg>
    </span>
  );
}

/** One Accounts Center row: an icon, a label, and a grey line under it. */
export function AccountRow({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-[12px] border-t border-[#e4e6eb] px-[14px] py-[12px] first:border-t-0">
      <span className="flex h-[36px] w-[44px] shrink-0 items-center justify-center text-[#1c2b33]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[16px] leading-[21px] text-[#1c2b33]">{label}</span>
        <span className="block text-[14px] leading-[19px] text-[#65676b]">{detail}</span>
      </span>
    </li>
  );
}
