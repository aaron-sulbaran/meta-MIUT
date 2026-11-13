"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  CalendarIcon,
  CloseIcon,
  MenuIcon,
  MuseMark,
  PlusSquareIcon,
} from "@/components/ui/icons";
import { ProfileAvatar } from "@/components/ui/tab-bar";

type Item = {
  label: string;
  detail: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
};

const ITEMS: Item[] = [
  {
    label: "Events",
    detail: "Map of what's on near you",
    href: "/",
    Icon: CalendarIcon,
  },
  {
    label: "Ask Muse",
    detail: "Find free food and events",
    href: "/ask",
    Icon: MuseMark,
  },
  {
    label: "Create an event",
    detail: "Post a flyer or say it out loud",
    href: "/organizer",
    Icon: PlusSquareIcon,
  },
];

/** The menu bars on Home: a side menu sliding in from the left. */
export function SideMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mr-[10px] flex h-[22px] w-[22px] items-center text-ink"
      >
        <MenuIcon className="h-[22px] w-[22px]" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[390px] overflow-hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <nav
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[82%] flex-col bg-page pt-[env(safe-area-inset-top)] shadow-xl"
            >
              <div className="flex h-[52px] items-center justify-between pl-[14px] pr-[6px]">
                <span className="font-display text-root-title font-semibold">
                  Menu
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center text-ink"
                >
                  <CloseIcon className="h-[20px] w-[20px]" />
                </button>
              </div>
              <div className="mx-[12px] flex items-center gap-[10px] rounded-card bg-wash px-[12px] py-[10px]">
                <ProfileAvatar size={36} />
                <span className="font-display text-label font-bold">
                  Your profile
                </span>
              </div>
              <ul className="mt-[12px] flex flex-col gap-[4px] px-[8px]">
                {ITEMS.map(({ label, detail, href, Icon }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-[12px] rounded-card px-[8px] py-[9px] active:bg-wash"
                    >
                      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <Icon className="h-[21px] w-[21px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-label font-bold">
                          {label}
                        </span>
                        <span className="block truncate text-meta text-muted">
                          {detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
