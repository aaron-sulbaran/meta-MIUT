import { connection } from "next/server";
import { Suspense } from "react";
import { EventFeed } from "@/components/events/event-feed";
import { TopPicks, TopPicksSkeleton } from "@/components/events/top-picks";
import { getEventStore } from "@/lib/events/store";

export default async function EventsTabPage() {
  await connection();
  const now = new Date();
  const events = await getEventStore().listEvents();

  return (
    <>
      <Suspense fallback={<TopPicksSkeleton />}>
        <TopPicks events={events} now={now} />
      </Suspense>
      <EventFeed events={events} nowIso={now.toISOString()} />
    </>
  );
}
