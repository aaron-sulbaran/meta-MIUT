"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

// The main page of each section this tab visited (Home, or Events as map or list),
// so a back arrow returns to the section you came from, not just the last page.
// Kept in sessionStorage, which is per tab like history.
const KEY = "nav-trail";

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
    const page = mainPage(pathname, search);
    if (!page) return;
    const trail = readTrail().filter((item) => section(item) !== section(page));
    try {
      sessionStorage.setItem(KEY, JSON.stringify([...trail, page].slice(-2)));
    } catch {}
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
        router.push(target);
      }}
    >
      {children}
    </Link>
  );
}
