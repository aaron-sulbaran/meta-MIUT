"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

// The main page of each section this tab visited (Home, or Events as map or list),
// so a back arrow returns to the section you came from, not just the last page.
// Kept in sessionStorage, which is per tab like history.
const KEY = "nav-trail";
const SCROLL = "nav-scroll:";
const RESTORE = "nav-restore";
// The last page visited other than a Get Facebook page, for its back arrow.
const LAST = "nav-last";

function mainPage(pathname: string, search: URLSearchParams): string | null {
  if (pathname === "/home") return "/home";
  if (pathname === "/") return search.get("view") === "list" ? "/?view=list" : "/";
  return null;
}

const section = (page: string) => (page === "/home" ? "home" : "events");

function readTrail(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function TrailRecorder() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (pathname.startsWith("/get-facebook")) return;
    const main = mainPage(pathname, search);
    const query = search.toString();
    const page = main ?? (query ? `${pathname}?${query}` : pathname);
    try {
      sessionStorage.setItem(LAST, page);
      if (main) {
        const trail = readTrail().filter((item) => section(item) !== section(main));
        sessionStorage.setItem(KEY, JSON.stringify([...trail, main].slice(-2)));
      }
    } catch {}

    // Back to this page puts you where you were scrolled, even once the list has loaded.
    // Content that loads in after (comments, who's going, photos) can shift the page, so it
    // holds the spot for a few seconds or until you scroll yourself.
    let restoring = false;
    let timer: number | undefined;
    let resizes: ResizeObserver | undefined;
    const stopRestoring = () => {
      restoring = false;
      resizes?.disconnect();
      window.clearTimeout(timer);
      for (const name of ["wheel", "touchstart", "keydown", "pointerdown"]) window.removeEventListener(name, stopRestoring);
    };
    try {
      const saved = Number(sessionStorage.getItem(SCROLL + page));
      if (sessionStorage.getItem(RESTORE) === page && saved > 0) {
        restoring = true;
        const hold = () => {
          if (restoring) window.scrollTo(0, saved);
        };
        hold();
        resizes = new ResizeObserver(hold);
        resizes.observe(document.body);
        timer = window.setTimeout(stopRestoring, 3000);
        for (const name of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(name, stopRestoring, { passive: true });
      }
      sessionStorage.removeItem(RESTORE);
    } catch {}
    const onScroll = () => {
      if (restoring) return;
      try {
        sessionStorage.setItem(SCROLL + page, String(Math.round(window.scrollY)));
      } catch {}
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stopRestoring();
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, search]);

  return null;
}

/** Mount once in the root layout. */
export function NavTrail() {
  return (
    <Suspense fallback={null}>
      <TrailRecorder />
    </Suspense>
  );
}

/** Goes to the last page visited, where you were scrolled; with none (a direct open), follows href. */
export function PreviousPageLink({ href, label, className, children }: { href: string; label: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(event) => {
        let target: string | null = null;
        try {
          target = sessionStorage.getItem(LAST);
          if (target) sessionStorage.setItem(RESTORE, target);
        } catch {}
        if (!target) return;
        event.preventDefault();
        router.push(target, { scroll: false });
      }}
    >
      {children}
    </Link>
  );
}

/** Goes to the main page of the section you came from; on a main page, to the other section; with none (a direct open), follows href. */
export function BackLink({ href, label, className, children }: { href: string; label: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(event) => {
        const here = mainPage(pathname, new URLSearchParams(window.location.search));
        const target = readTrail()
          .filter((page) => !here || section(page) !== section(here))
          .at(-1);
        if (!target) return;
        event.preventDefault();
        try {
          sessionStorage.setItem(RESTORE, target);
        } catch {}
        router.push(target, { scroll: false });
      }}
    >
      {children}
    </Link>
  );
}
