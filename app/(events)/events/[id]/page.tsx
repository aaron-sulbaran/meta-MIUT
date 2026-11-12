import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventActions } from "@/components/events/event-actions";
import { EventBadges } from "@/components/events/event-card";
import { Card } from "@/components/ui/card";
import { ChevronLeftIcon, MapPinIcon } from "@/components/ui/icons";
import { getEventStore } from "@/lib/events/store";
import { formatEventTime } from "@/lib/events/time";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const event = await getEventStore().getEvent(id);
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-3">
      <Card className="rounded-none">
        <Link href="/" className="mb-3 flex items-center gap-1 text-[14px] font-semibold text-muted">
          <ChevronLeftIcon className="h-4 w-4" /> Events
        </Link>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#e41e3f]">
          {formatEventTime(event, new Date())}
        </p>
        <h1 className="mt-1 text-[24px] font-bold leading-tight">{event.title}</h1>
        <p className="mt-2 flex items-center gap-1 text-[15px] text-muted">
          <MapPinIcon className="h-4 w-4 shrink-0" /> {event.place.name}
        </p>
        <p className="mt-1 text-[14px] text-muted">
          by {event.organizer.name} (@{event.organizer.handle})
        </p>
        <div className="mt-3">
          <EventBadges event={event} />
        </div>
        <div className="mt-4">
          <EventActions event={event} />
        </div>
      </Card>
      <Card className="mx-3">
        <h2 className="text-[17px] font-bold">Details</h2>
        <p className="mt-2 text-[15px]">{event.description}</p>
        {event.foodNote && <p className="mt-2 text-[14px] text-muted">Food: {event.foodNote}</p>}
      </Card>
      <Card className="mx-3">
        <h2 className="text-[17px] font-bold">Source post</h2>
        {event.source.kind === "instagram" ? (
          <div className="mt-2 rounded-md border border-divider p-3">
            <p className="text-[13px] font-semibold">@{event.organizer.handle} on Instagram</p>
            {event.source.caption && <p className="mt-1 text-[14px]">{event.source.caption}</p>}
            {event.source.postUrl && <p className="mt-1 break-all text-[12px] text-muted">{event.source.postUrl}</p>}
          </div>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Added by hand by the organizer.</p>
        )}
      </Card>
    </div>
  );
}
