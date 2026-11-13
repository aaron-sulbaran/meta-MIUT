"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isStagedScreen } from "@/lib/demo/staged";
import { Fragment, type ComponentType } from "react";
import {
  BellIcon,
  CalendarFilledIcon,
  CalendarIcon,
  HomeFilledIcon,
  HomeIcon,
  MarketplaceIcon,
  VideoIcon,
} from "@/components/ui/icons";

// The floating pill tab bar from the Facebook iOS app. Home and Events (in the
// Friends slot, opening the map) are live; the others are drawn so the chrome
// reads true, but they are inert: not links, not focusable, no pressed state.

type InertTab = { label: string; Icon: ComponentType<{ className?: string }>; dot?: boolean; count?: number };

const INERT_TABS: InertTab[] = [
  { label: "Video", Icon: VideoIcon, dot: true },
  { label: "Marketplace", Icon: MarketplaceIcon, dot: true },
  { label: "Notifications", Icon: BellIcon, dot: true },
];

// The reference screen copies the app's badge count; everywhere else the
// badge is a plain dot, because this demo computes no notification count.
const REFERENCE_TABS: InertTab[] = INERT_TABS.map((tab) =>
  tab.label === "Notifications" ? { ...tab, dot: false, count: 7 } : tab,
);

const EVENTS_PATHS = ["/events", "/map", "/ask"];
const tab = (active: boolean) =>
  `flex h-[38.6px] items-center justify-center rounded-full ${active ? "bg-primary-soft text-primary" : "text-ink"}`;

function InertTabIcon({ Icon, dot, count }: InertTab) {
  return (
    <span aria-hidden className="relative flex h-[39px] items-center justify-center text-ink">
      <span className="relative">
        <Icon className="h-[23.5px] w-[23.5px]" />
        {dot && <span className="absolute left-[calc(50%+9.7px-3.85px)] top-[calc(50%-9.5px-3.85px)] h-[7.7px] w-[7.7px] rounded-full bg-badge" />}
        {count !== undefined && (
          <span className="absolute left-[calc(50%+9.5px-10.25px)] top-[calc(50%-9.6px-10.25px)] flex h-[20.5px] min-w-[20.5px] items-center justify-center rounded-full border-[1.5px] border-card bg-badge px-[4px] font-display text-[12.5px] font-bold leading-none text-white tabular-nums">
            {count}
          </span>
        )}
      </span>
    </span>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const onEvents = pathname === "/" || EVENTS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const tabs = pathname.startsWith("/reference") ? REFERENCE_TABS : INERT_TABS;
  // Staged screens imitate another app (Instagram); Facebook's tab bar stays off them.
  if (isStagedScreen(pathname)) return null;
  return (
    <nav
      aria-label="Facebook"
      className="pointer-events-none fixed inset-x-0 z-30 mx-auto w-full max-w-[390px] px-[12px]"
      style={{ bottom: "var(--tabbar-gap)" }}
    >
      <div className="pointer-events-auto grid h-[var(--tabbar-height)] grid-cols-6 items-center rounded-full border border-tabbar-border bg-card px-[5px]">
        <Link href="/home" aria-label="Home" aria-current={onEvents ? undefined : "page"} className={tab(!onEvents)}>
          {onEvents ? <HomeIcon className="h-[23px] w-[23px]" /> : <HomeFilledIcon className="h-[23px] w-[23px]" />}
        </Link>
        {tabs.map((item, index) => (
          <Fragment key={item.label}>
            <InertTabIcon {...item} />
            {index === 0 && (
              <Link href="/" aria-label="Events" aria-current={onEvents ? "page" : undefined} className={tab(onEvents)}>
                {onEvents ? <CalendarFilledIcon className="h-[23px] w-[23px]" /> : <CalendarIcon className="h-[23.5px] w-[23.5px]" />}
              </Link>
            )}
          </Fragment>
        ))}
        <span aria-hidden className="flex h-[39px] items-center justify-center">
          <ProfileAvatar size={25} ring />
        </span>
      </div>
    </nav>
  );
}

// No photos of people: the profile slot is an initial on a color field.
export function ProfileAvatar({ size = 27, initial = "A", ring = false }: { size?: number; initial?: string; ring?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-[#1c2b33] font-display font-bold text-white ${ring ? "ring-[1.5px] ring-ink ring-offset-[1.5px] ring-offset-card" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
    >
      {initial}
    </span>
  );
}
