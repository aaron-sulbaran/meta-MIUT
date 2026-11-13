import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { BackLink, PreviousPageLink } from "@/components/ui/back-link";
import { ChevronLeftIcon, MenuIcon } from "@/components/ui/icons";

// Three header patterns from the Facebook iOS app. Each takes an actions slot
// on the right; fill it with HeaderAction items.

/** Where icons this demo has no screen for lead: a pointer to the real app. */
export const GET_FACEBOOK = "/get-facebook";

export const getFacebookHref = (from: string) => `${GET_FACEBOOK}?from=${from}`;

const bar = "sticky top-0 z-20 bg-card pt-[env(safe-area-inset-top)]";

/** Home feed: menu, the wordmark set in type, actions. Pass menu to make the bars live. */
export function HomeHeader({ wordmark, actions, menu }: { wordmark: string; actions?: ReactNode; menu?: ReactNode }) {
  return (
    <header className={bar}>
      <div className="flex h-[52px] items-center pl-[10px] pr-[8px]">
        {menu ?? (
          <Link href={GET_FACEBOOK} aria-label="Menu" className="mr-[10px] flex h-[22px] w-[22px] items-center text-ink">
            <MenuIcon className="h-[22px] w-[22px]" />
          </Link>
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
        <Link href={GET_FACEBOOK} aria-label="Menu" className="mr-[11px] flex h-[22px] w-[22px] items-center text-ink">
          <MenuIcon className="h-[22px] w-[22px]" />
        </Link>
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
  previousBack = false,
}: {
  title: string;
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
  /** Go back to the exact page you came from (backHref on a direct open), not the section. */
  previousBack?: boolean;
}) {
  const backClass = "flex h-11 w-11 items-center justify-start pl-[4px] text-ink";
  const chevron = <ChevronLeftIcon className="h-[18px] w-[18px]" />;
  return (
    <header className={bar}>
      <div className="relative flex h-[52px] items-center pl-[10px] pr-[2px]">
        {previousBack ? (
          <PreviousPageLink href={backHref} label={backLabel} className={backClass}>
            {chevron}
          </PreviousPageLink>
        ) : (
          <BackLink href={backHref} label={backLabel} className={backClass}>
            {chevron}
          </BackLink>
        )}
        <h1 className="pointer-events-none absolute inset-x-[120px] truncate text-center font-display text-title font-bold">{title}</h1>
        <HeaderActions>{actions}</HeaderActions>
      </div>
    </header>
  );
}

function HeaderActions({ children }: { children?: ReactNode }) {
  return <div className="ml-auto flex items-center">{children}</div>;
}

type HeaderActionProps = { label: string; Icon: ComponentType<{ className?: string }>; href?: string; iconClass?: string };

/** One icon in a header's action slot. Without an href it leads to the Get Facebook page. */
export function HeaderAction({ label, Icon, href = GET_FACEBOOK, iconClass = "h-[21.6px] w-[21.6px]" }: HeaderActionProps) {
  return (
    <Link href={href} aria-label={label} className="flex h-[44px] w-[42.6px] items-center justify-center text-ink">
      <Icon className={iconClass} />
    </Link>
  );
}
