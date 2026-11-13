import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { BackLink } from "@/components/ui/back-link";
import { ChevronLeftIcon, MenuIcon } from "@/components/ui/icons";

// Three header patterns from the Facebook iOS app. Each takes an actions slot
// on the right; fill it with HeaderAction items.

const bar = "sticky top-0 z-20 bg-card pt-[env(safe-area-inset-top)]";

/** Home feed: menu, the wordmark set in type, actions. Pass menu to make the bars live. */
export function HomeHeader({ wordmark, actions, menu }: { wordmark: string; actions?: ReactNode; menu?: ReactNode }) {
  return (
    <header className={bar}>
      <div className="flex h-[52px] items-center pl-[10px] pr-[8px]">
        {menu ?? (
          <span aria-hidden className="mr-[10px] flex h-[22px] w-[22px] items-center text-ink">
            <MenuIcon className="h-[22px] w-[22px]" />
          </span>
        )}
        <span className="pb-[3px] font-display text-[29px] leading-[34px] font-extrabold tracking-[-0.05em] text-primary">{wordmark}</span>
        <HeaderActions>{actions}</HeaderActions>
      </div>
    </header>
  );
}

/** A main section such as Marketplace: menu and a large title, actions. */
export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className={bar}>
      <div className="flex h-[52px] items-center pl-[10px] pr-[8px]">
        <span aria-hidden className="mr-[11px] flex h-[22px] w-[22px] items-center text-ink">
          <MenuIcon className="h-[22px] w-[22px]" />
        </span>
        <h1 className="font-display text-root-title font-semibold">{title}</h1>
        <HeaderActions>{actions}</HeaderActions>
      </div>
    </header>
  );
}

/** A screen inside a section: back chevron, centered title, actions. Back returns to the previous page; backHref is for a direct open. */
export function SubPageHeader({
  title,
  backHref,
  backLabel = "Back",
  actions,
}: {
  title: string;
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={bar}>
      <div className="relative flex h-[52px] items-center pl-[10px] pr-[2px]">
        <BackLink href={backHref} label={backLabel} className="flex h-11 w-11 items-center justify-start pl-[4px] text-ink">
          <ChevronLeftIcon className="h-[18px] w-[18px]" />
        </BackLink>
        <h1 className="pointer-events-none absolute inset-x-[120px] truncate text-center font-display text-title font-bold">{title}</h1>
        <HeaderActions>{actions}</HeaderActions>
      </div>
    </header>
  );
}

function HeaderActions({ children }: { children?: ReactNode }) {
  return <div className="ml-auto flex items-center">{children}</div>;
}

type HeaderActionProps = { label: string; Icon: ComponentType<{ className?: string }>; href?: string };

/**
 * One icon in a header's action slot. With an href it is a link; without one it
 * is drawn but inert (not focusable, hidden from assistive tech), used only
 * where the reference app shows an icon this demo has no destination for.
 */
export function HeaderAction({ label, Icon, href }: HeaderActionProps) {
  const icon = <Icon className="h-[21.6px] w-[21.6px]" />;
  const box = "flex h-[44px] w-[42.6px] items-center justify-center text-ink";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={box}>
        {icon}
      </Link>
    );
  }
  return (
    <span aria-hidden className={box}>
      {icon}
    </span>
  );
}
