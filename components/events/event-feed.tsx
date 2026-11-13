"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChipRow, FilterChip, LocationChip } from "@/components/ui/chips";
import { SectionHeading } from "@/components/ui/section-heading";
import { EventCard } from "@/components/events/event-card";
import { DismissButton, useDismissed } from "@/components/events/dismissed";
import {
  EVENT_CHIPS,
  EVENT_CHIP_HEADINGS,
  EVENT_CHIP_LABELS,
  eventsForChip,
  type EventChip,
} from "@/components/events/chip-filter";
import type { CampusEvent } from "@/lib/events/schema";
import { FEED_FILTER_EVENT, type FeedFilter } from "@/lib/muse/types";

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
  const { dismissed, dismiss } = useDismissed();
  // Free has the X (Not for me), like For you; the time chips list everything.
  const visible = eventsForChip(events, chip, now).filter((event) => chip !== "free" || !dismissed.has(event.id));

  // Ask Muse can switch the list ("show me what's free").
  useEffect(() => {
    const onFilter = (event: Event) => setChip((event as CustomEvent<FeedFilter>).detail);
    window.addEventListener(FEED_FILTER_EVENT, onFilter);
    return () => window.removeEventListener(FEED_FILTER_EVENT, onFilter);
  }, []);

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

      {/* For you is only Muse's picks; the unfiltered list is under the other chips. */}
      {chip === "forYou" ? (
        topPicks
      ) : (
      <section aria-labelledby="event-list-heading" className="pt-[21px]">
        <SectionHeading id="event-list-heading" title={EVENT_CHIP_HEADINGS[chip]} />
        <div className="mt-[7px] flex flex-col gap-[7.6px] px-3">
          {visible.length === 0 ? (
            <p className="rounded-card border border-hairline px-4 py-6 text-center text-body text-muted">
              Nothing here yet. Try This week.
            </p>
          ) : (
            visible.map((event) =>
              chip === "free" ? (
                <div key={event.id} className="relative">
                  <EventCard event={event} now={now} />
                  <DismissButton title={event.title} onDismiss={() => dismiss(event.id)} />
                </div>
              ) : (
                <EventCard key={event.id} event={event} now={now} />
              ),
            )
          )}
        </div>
      </section>
      )}
    </div>
  );
}
