"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/ui/icons";
import type { CampusEvent } from "@/lib/events/schema";

// Share for the event page, drawn as one icon in the page header (lisa). The
// old action row (Interested, RSVP) is gone: going and RSVP live in Who's
// going, so there is one going button on the page.
export function EventShareAction({ event }: { event: CampusEvent }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(`/events/${event.id}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The student closed the share sheet.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${event.title}`}
      className="relative flex h-[44px] w-[42.6px] items-center justify-center text-ink"
    >
      <ShareIcon className="h-[21.6px] w-[21.6px]" />
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}
