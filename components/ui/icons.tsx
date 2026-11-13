import type { SVGProps } from "react";

// Line icons drawn after the Facebook iOS app's set: 24 px grid, round caps,
// 1.9 stroke. Filled variants mark the active tab. All are decorative
// (aria-hidden); the control around an icon carries the label.

type IconProps = { className?: string };

const line: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

const solid: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  focusable: false,
};

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.6} className={className}>
      <path d="M16 1.5 6 12l10 10.5" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function PlusSquareIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.1} className={className}>
      <rect x="1.05" y="1.05" width="21.9" height="21.9" rx="5.6" />
      <path d="M12 5.8v12.4M5.8 12h12.4" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.1} className={className}>
      <circle cx="10.6" cy="10.6" r="9.5" />
      <path d="m17.6 17.6 5 5" />
    </svg>
  );
}

export function MoreCircleIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="11" />
      <g fill="currentColor" stroke="none">
        <circle cx="6.2" cy="12" r="1.55" />
        <circle cx="12" cy="12" r="1.55" />
        <circle cx="17.8" cy="12" r="1.55" />
      </g>
    </svg>
  );
}

export function MoreDotsIcon({ className }: IconProps) {
  return (
    <svg {...solid} className={className}>
      <circle cx="8.6" cy="12" r="1.15" />
      <circle cx="12" cy="12" r="1.15" />
      <circle cx="15.4" cy="12" r="1.15" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <path d="M3 5.5h18M3 12h18M3 18.5h18" />
    </svg>
  );
}

export function ChatBoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable={false} className={className}>
      <mask id="chat-bolt-cutout">
        <rect width="24" height="24" fill="#fff" />
        <path d="m6.3 14.6 3.9-4.2 2.6 2 4.9-3.9-3.9 4.2-2.6-2z" fill="#000" stroke="#000" strokeWidth={1.2} strokeLinejoin="round" />
      </mask>
      <path
        mask="url(#chat-bolt-cutout)"
        fill="currentColor"
        d="M12 1.8C6.2 1.8 1.8 6 1.8 11.5c0 2.9 1.2 5.4 3.2 7.1v3.6l3.3-1.9c1.1.3 2.4.5 3.7.5 5.8 0 10.2-4.2 10.2-9.3S17.8 1.8 12 1.8z"
      />
    </svg>
  );
}

export function PhotoIcon({ className }: IconProps) {
  return (
    <svg {...solid} className={className}>
      <path fillRule="evenodd" d="M7.5 1.5h9a3.5 3.5 0 0 1 3.5 3.5v14a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 19V5a3.5 3.5 0 0 1 3.5-3.5zm-1 3v15h11v-15z" />
      <circle cx="9.3" cy="7.8" r="1.8" />
      <path d="M6.5 14.5c1-1.2 2-1.6 3-1.1l1.2.7c.8-1.6 2.1-3 3.5-3 1.4 0 2.6 1 3.3 1.8v6.6h-11z" />
    </svg>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={1.5} className={className}>
      <path d="M12 21.6c-3-3-7.35-7.8-7.35-12a7.35 7.35 0 0 1 14.7 0c0 4.2-4.35 9-7.35 12Z" />
      <circle cx="12" cy="9.3" r="2.4" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.4} className={className}>
      <path d="M12 2.8 14.82 8.92 21.51 9.71 16.57 14.28 17.88 20.89 12 17.6 6.12 20.89 7.43 14.28 2.49 9.71 9.18 8.92Z" />
    </svg>
  );
}

export function StarFilledIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.4} fill="currentColor" className={className}>
      <path d="M12 2.8 14.82 8.92 21.51 9.71 16.57 14.28 17.88 20.89 12 17.6 6.12 20.89 7.43 14.28 2.49 9.71 9.18 8.92Z" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2.1} className={className}>
      <path d="M12.4 8.85V3.6L22 12l-9.6 8.4v-4.8c-4.4-.2-7.2 1.4-8.8 3.8 0-6 3.6-10.2 8.8-10.55Z" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M12 6.75V12l3.5 2" />
    </svg>
  );
}

export function TicketIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <path d="M3.25 7.5a2 2 0 0 1 2-2h13.5a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H5.25a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5Z" />
      <path d="M14.5 5.5v13" strokeDasharray="2 2.4" />
    </svg>
  );
}

export function FoodIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <path d="M6.5 2.75v7.5M4 2.75v4.5a2.5 2.5 0 0 0 5 0v-4.5M6.5 10.25v11" />
      <path d="M17.5 21.25V2.75c-2.5 1.2-3.75 4-3.75 7.75v3.25h3.75" />
    </svg>
  );
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <circle cx="9" cy="7.75" r="3.75" />
      <path d="M2.25 20.25c0-3.6 3-6 6.75-6s6.75 2.4 6.75 6Z" />
      <path d="M16 4.25a3.5 3.5 0 0 1 0 7M18 14.4c2.3.6 3.75 2.6 3.75 5.1v.75" />
    </svg>
  );
}

export function InstagramPostIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

// Tab bar set

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <path d="M3.5 10.6c0-.7.3-1.3.9-1.7l6.4-5.1a2 2 0 0 1 2.4 0l6.4 5.1c.6.4.9 1 .9 1.7V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M9.7 21v-4.3a2.3 2.3 0 0 1 4.6 0V21" />
    </svg>
  );
}

export function HomeFilledIcon({ className }: IconProps) {
  return (
    <svg {...solid} className={className}>
      <path fillRule="evenodd" d="M2.5 10.6c0-1 .5-1.9 1.3-2.5l6.4-5.1a3 3 0 0 1 3.6 0l6.4 5.1c.8.6 1.3 1.5 1.3 2.5V19a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3zM10 15.5v6.5h4v-6.5a.8.8 0 0 0-.8-.8h-2.4a.8.8 0 0 0-.8.8z" />
    </svg>
  );
}

export function VideoIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M3 8.3h18M7.4 3.2l2.2 5M12.4 3.2l2.2 5" />
      <path d="M10 11.6v5.2l4.4-2.6z" fill="currentColor" />
    </svg>
  );
}

export function FriendsIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <circle cx="8" cy="10.3" r="2.7" />
      <rect x="2.5" y="16" width="11" height="5" rx="2.5" />
      <circle cx="16" cy="5.6" r="2.6" />
      <path d="M13.6 12.2h3.2a3.1 3.1 0 0 1 0 6.2h-1.6" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <rect x="3.5" y="4.5" width="17" height="16.5" rx="3" />
      <path d="M3.5 9.6h17M8 2.8v3.4M16 2.8v3.4" />
      <rect x="7.4" y="12.6" width="3.6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CalendarFilledIcon({ className }: IconProps) {
  return (
    <svg {...solid} className={className}>
      <path fillRule="evenodd" d="M8 1.8a1 1 0 0 1 1 1V3.5h6v-.7a1 1 0 1 1 2 0v.7h.5a3 3 0 0 1 3 3V19a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3H7v-.7a1 1 0 0 1 1-1zM5.5 10.4V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.6z" />
      <rect x="7.4" y="12.6" width="3.6" height="3.6" rx="0.8" />
    </svg>
  );
}

export function MarketplaceIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <path d="M3.5 8.5c0-2.5 1.7-4.5 4.5-4.5h8c2.8 0 4.5 2 4.5 4.5" />
      <path d="M3.5 8.5c0 1.7.9 2.6 2.1 2.6s2.1-.9 2.1-2.4c0 1.5.9 2.4 2.1 2.4s2.2-.9 2.2-2.4c0 1.5 1 2.4 2.2 2.4s2.1-.9 2.1-2.4c0 1.5.9 2.4 2.1 2.4s2.1-.9 2.1-2.6" />
      <path d="M5 11.2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.8" />
      <path d="M10 21v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2.1H4.2z" />
      <path d="M9.8 18.8a2.2 2.2 0 0 0 4.4 0" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={2} className={className}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

/** A waving hand, for Say hi: fingers together, thumb out, two motion arcs. */
export function WaveIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={1.6} className={className}>
      <g transform="translate(12.4 12.4) rotate(-38) scale(0.95) translate(-13.8 -12.8)">
        <path d="M5.5 15V8a1.25 1.25 0 0 1 2.5 0V6a1.25 1.25 0 0 1 2.5 0v-.5a1.25 1.25 0 0 1 2.5 0v1a1.25 1.25 0 0 1 2.5 0v7.5l3.7-6.4a1.45 1.45 0 0 1 2.55 1.4L18 17.2A6.2 6.2 0 0 1 12.3 21h-1.3a5.5 5.5 0 0 1-5.5-5.5Z" />
        <path d="M8 8v5M10.5 6v6.5M13 6.5v6" />
      </g>
      <path d="M16.6 1.6a6.5 6.5 0 0 1 4.8 3.8M16.3 4.1a3.6 3.6 0 0 1 2.4 2.1M1.8 16.2a6.5 6.5 0 0 0 3.6 4.6M4.3 16.4a3.6 3.6 0 0 0 1.9 2.3" />
    </svg>
  );
}

export function LikeIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7.2a1.9 1.9 0 0 1 3.5 1.2L13.8 9H19a2 2 0 0 1 2 2.3l-1.2 7.5A2.6 2.6 0 0 1 17.2 21H7" />
    </svg>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <svg {...line} className={className}>
      <path d="M12 3.5c5 0 9 3.6 9 8s-4 8-9 8c-1.1 0-2.2-.2-3.2-.5L4 20.5l1.3-3.9A7.6 7.6 0 0 1 3 11.5c0-4.4 4-8 9-8Z" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...line} strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" />
    </svg>
  );
}
