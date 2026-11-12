"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { InterestedButton, ShareButton } from "@/components/ui/event-actions";
import { TicketIcon } from "@/components/ui/icons";
import type { CampusEvent } from "@/lib/events/schema";

// The event page's action row: Interested, RSVP when the event takes RSVPs,
// and share. Local state only for now; the events lane wires it to the store.
export function EventActions({ event }: { event: CampusEvent }) {
  const [rsvped, setRsvped] = useState(false);

  return (
    <div className="flex gap-[7.6px]">
      {event.access.kind === "rsvp" && (
        <button
          type="button"
          aria-pressed={rsvped}
          onClick={() => setRsvped((value) => !value)}
          className={buttonClass(rsvped ? "soft" : "primary", "flex-1")}
        >
          <TicketIcon className="h-[17px] w-[17px] shrink-0" />
          {rsvped ? "You're going" : "RSVP"}
        </button>
      )}
      <InterestedButton className="flex-1" />
      <ShareButton path={`/events/${event.id}`} title={event.title} />
    </div>
  );
}
