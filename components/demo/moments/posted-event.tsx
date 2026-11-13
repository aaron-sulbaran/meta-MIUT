import Link from "next/link";
import { BrandMark } from "@/components/demo/moments/brand-mark";
import type { Alert } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";
import { formatDateLine } from "@/lib/events/time";

// O5: the organizer's post, live as a Facebook event. A quiet confirmation
// above the event card, everything on the card read from the stored event.

function metaLine(event: CampusEvent): string {
  const parts = [event.free ? "Free" : null, event.food ? (event.foodNote ? event.foodNote.charAt(0).toUpperCase() + event.foodNote.slice(1) : "Free food") : null, event.access.kind === "rsvp" ? "RSVP required" : "Open to everyone"];
  return parts.filter(Boolean).join(" · ");
}

export function PostedEvent({ event, alert, flyerSrc, now }: { event: CampusEvent; alert: Alert | null; flyerSrc: string; now: Date }) {
  return (
    <section aria-live="polite" className="posted-enter flex flex-col gap-[12px]">
      <style>{POSTED_CSS}</style>
      <div className="flex items-center gap-[10px] rounded-card bg-primary-soft px-[12px] py-[10px]">
        <BrandMark name="facebook" className="h-[28px] w-[28px]" decorative />
        <div className="min-w-0">
          <p className="font-display text-label font-bold">Posted to Facebook Events</p>
          <p className="text-meta font-semibold text-muted">
            As {event.organizer.name}
            {alert ? ". Students nearby are getting a notification." : ""}
          </p>
        </div>
      </div>

      <article className="overflow-hidden rounded-card border border-hairline bg-card">
        <div className="aspect-[2/1] w-full overflow-hidden bg-wash">
          {/* The organizer's flyer, as the event's cover. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyerSrc} alt="" className="h-full w-full object-cover object-top" />
        </div>
        <div className="px-[12px] pt-[12px] pb-[14px]">
          <p className="text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
          <h2 className="mt-[4px] font-display text-[20px] leading-[24px] font-bold">{event.title}</h2>
          <p className="mt-[2px] text-venue font-semibold text-ink">{event.place.name}</p>
          <p className="mt-[3px] text-meta font-semibold text-muted">{metaLine(event)}</p>
          <p className="mt-[3px] text-meta text-muted">Hosted by {event.organizer.name}</p>
          <Link
            href={`/events/${encodeURIComponent(event.id)}`}
            className="mt-[12px] flex h-[36px] items-center justify-center rounded-button bg-button font-display text-label font-bold text-ink"
          >
            View event
          </Link>
        </div>
      </article>
    </section>
  );
}

const POSTED_CSS = `
@keyframes posted-enter { from { opacity: 0; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: none; } }
.posted-enter { animation: posted-enter 420ms cubic-bezier(.3,.7,.3,1) both; }
@media (prefers-reduced-motion: reduce) { .posted-enter { animation: none; } }
`;
