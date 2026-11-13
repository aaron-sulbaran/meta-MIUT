"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { DismissButton, useDismissed } from "@/components/events/dismissed";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";

// Every other upcoming event, in Muse's order (forYouOrder): the ones the student
// is likely to care about first, then the rest by time. X hides one for good.
// Why each matched stays inside the agent. Sits under the Top 3 on For you.
export function MoreForYou({ events, nowIso }: { events: CampusEvent[]; nowIso: string }) {
  const now = new Date(nowIso);
  const { dismissed, dismiss } = useDismissed();
  const rows = events.filter((event) => !dismissed.has(event.id));
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="more-for-you-heading" className="pt-[21px]">
      <SectionHeading id="more-for-you-heading" title="More you might like" />
      <ul className="mt-[7px] flex flex-col gap-[7.6px] px-3">
        {rows.map((event) => (
          <li key={event.id} className="relative">
            <Link
              href={`/events/${event.id}`}
              className="flex flex-col rounded-card border border-hairline bg-card py-[10px] pl-[11.3px] pr-[36px]"
            >
              <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
              <h3 className="mt-[2px] font-display text-label font-bold">{event.title}</h3>
              <p className="mt-[1px] text-meta font-semibold text-muted">
                {event.place.name} · {event.free ? "Free" : "Paid entry"}
              </p>
            </Link>
            <DismissButton title={event.title} onDismiss={() => dismiss(event.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
