import Image from "next/image";
import type { ReactNode } from "react";

// Pieces of Meta's account surfaces, after Aaron's references in the hub
// (kb/meta-accounts-reference): Meta's official lockup (a file from Meta's
// brand resources, Aaron's call), and drawn round profile pictures with a small
// app badge at the lower right, and Accounts Center rows. No real photos.

export const META_SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";

/** Meta's official lockup (public/brand/meta-lockup.svg, from Meta's brand resources), at the size Meta's sheets use. */
export function MetaLockup({ height = 15, className = "" }: { height?: number; className?: string }) {
  return <Image src="/brand/meta-lockup.svg" alt="Meta" width={Math.round(height * LOCKUP_RATIO)} height={height} unoptimized className={className} />;
}

// The lockup's own proportions (its cropped viewBox, 4978 by 1020).
const LOCKUP_RATIO = 4978 / 1020;

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

/** A small app badge at the lower right of a profile picture: Facebook's or Instagram's own logo. */
export function AppBadge({ app, size }: { app: "instagram" | "facebook"; size: number }) {
  if (app === "facebook") {
    // Facebook's official logo (public/brand/facebook-f.svg).
    return (
      <span className="flex rounded-full bg-white ring-2 ring-white" style={{ width: size, height: size }}>
        <Image src="/brand/facebook-f.svg" alt="Facebook" width={size} height={size} unoptimized />
      </span>
    );
  }
  // Instagram's official gradient glyph (public/brand/instagram-glyph.png) on a white tile, as in Meta's account cards.
  return (
    <span className="flex items-center justify-center rounded-[30%] bg-white ring-2 ring-white" style={{ width: size, height: size }}>
      <Image src="/brand/instagram-glyph.png" alt="Instagram" width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} unoptimized />
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
