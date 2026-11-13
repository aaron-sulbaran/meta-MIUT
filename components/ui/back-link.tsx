"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

// The pages this tab has visited inside the app, so a back arrow can return to
// the page you came from. Kept in sessionStorage, which is per tab like history.
const KEY = "nav-trail";
let popped = false;

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
  const search = useSearchParams().toString();

  useEffect(() => {
    const onPop = () => {
      popped = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const here = search ? `${pathname}?${search}` : pathname;
    const trail = readTrail();
    if (trail.at(-1) !== here) {
      if (popped && trail.at(-2) === here) trail.pop();
      else trail.push(here);
    }
    popped = false;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-50)));
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

/** Goes back to the previous page in the app; with none (a direct open), follows href. */
export function BackLink({ href, label, className, children }: { href: string; label: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (readTrail().length < 2) return;
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
