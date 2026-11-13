"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { ShareIcon, StarFilledIcon, StarIcon } from "@/components/ui/icons";

/** The full-width grey Interested button with a star. Toggles locally, and remembers it for this tab when given an id. */
export function InterestedButton({ id, className = "" }: { id?: string; className?: string }) {
  const [interested, setInterested] = useState(false);
  const key = id ? `interested:${id}` : null;

  useEffect(() => {
    if (!key) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem(key) === "1") setInterested(true);
      } catch {}
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  function toggle() {
    const next = !interested;
    setInterested(next);
    if (!key) return;
    try {
      if (next) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    } catch {}
  }

  return (
    <button
      type="button"
      aria-pressed={interested}
      onClick={toggle}
      className={buttonClass(interested ? "soft" : "secondary", className)}
    >
      {interested ? (
        <StarFilledIcon className="h-[17px] w-[17px] shrink-0" />
      ) : (
        <StarIcon className="h-[17px] w-[17px] shrink-0" />
      )}
      Interested
    </button>
  );
}

/**
 * The square share button. Uses the system share sheet when there is one,
 * otherwise copies the link, and says which happened.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [receipt, setReceipt] = useState<string | null>(null);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setReceipt("Link copied");
    } catch {
      setReceipt(null);
      return;
    }
    window.setTimeout(() => setReceipt(null), 1800);
  }

  return (
    <button type="button" onClick={share} aria-label={`Share ${title}`} className={buttonClass("secondary", "relative w-[46.6px] shrink-0 px-0")}>
      <ShareIcon className="h-[17px] w-[17px]" />
      <span role="status" className="sr-only">
        {receipt ?? ""}
      </span>
      {receipt && (
        <span className="absolute bottom-[calc(100%+6px)] right-0 rounded-md bg-ink px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-white">
          {receipt}
        </span>
      )}
    </button>
  );
}
