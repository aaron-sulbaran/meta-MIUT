"use client";

import { useState } from "react";
import type { CampusEvent } from "@/lib/events/schema";
import { StarIcon } from "@/components/ui/icons";

// Local state only for now. The events lane wires this to the store.
export function EventActions({ event }: { event: CampusEvent }) {
  const [interested, setInterested] = useState(false);
  const [rsvped, setRsvped] = useState(false);

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={interested}
        onClick={() => setInterested((value) => !value)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[15px] font-semibold ${
          interested ? "bg-primary text-white" : "bg-wash text-ink"
        }`}
      >
        <StarIcon className="h-5 w-5" />
        Interested
      </button>
      {event.access.kind === "rsvp" && (
        <button
          type="button"
          aria-pressed={rsvped}
          onClick={() => setRsvped((value) => !value)}
          className={`flex-1 rounded-md py-2 text-[15px] font-semibold ${
            rsvped ? "bg-free text-white" : "bg-primary text-white"
          }`}
        >
          {rsvped ? "You're going" : "RSVP"}
        </button>
      )}
    </div>
  );
}
