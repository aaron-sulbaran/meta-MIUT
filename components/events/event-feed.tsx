"use client";

import { useState, type ReactNode } from "react";
import { ChipRow, FilterChip, LocationChip } from "@/components/ui/chips";
import { SectionHeading } from "@/components/ui/section-heading";
import { EventCard } from "@/components/events/event-card";
import {
  EVENT_CHIPS,
  EVENT_CHIP_HEADINGS,
  EVENT_CHIP_LABELS,
  eventsForChip,
  type EventChip,
} from "@/components/events/chip-filter";
import type { CampusEvent } from "@/lib/events/schema";

/**
 * The chip row and the list it filters. `topPicks` is rendered by the server
 * (it runs the rank job) and only shows under For you.
 */
export function EventFeed({
  events,
  nowIso,
  campus,
  topPicks,
}: {
  events: CampusEvent[];
  nowIso: string;
  campus: string;
  topPicks: ReactNode;
}) {
  const now = new Date(nowIso);
  const [chip, setChip] = useState<EventChip>("forYou");
  const visible = eventsForChip(events, chip, now);

  return (
    <div>
      <ChipRow label="Filter events">
        <LocationChip place={campus} />
        {EVENT_CHIPS.map((option) => (
          <FilterChip key={option} active={chip === option} onSelect={() => setChip(option)}>
            {EVENT_CHIP_LABELS[option]}
          </FilterChip>
        ))}
      </ChipRow>

      {chip === "forYou" && topPicks}

      <section aria-labelledby="event-list-heading" className="pt-[21px]">
        <SectionHeading id="event-list-heading" title={EVENT_CHIP_HEADINGS[chip]} />
        <div className="mt-[7px] flex flex-col gap-[7.6px] px-3">
          {visible.length === 0 ? (
            <p className="rounded-card border border-hairline px-4 py-6 text-center text-body text-muted">
              Nothing here yet. Try This week.
            </p>
          ) : (
            visible.map((event) => <EventCard key={event.id} event={event} now={now} />)
          )}
        </div>
      </section>
    </div>
  );
}
