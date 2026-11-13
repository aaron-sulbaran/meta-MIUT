import { connection } from "next/server";
import { Suspense } from "react";
import { AskBar } from "@/components/ask/ask-bar";
import { EventFeed } from "@/components/events/event-feed";
import { TopPicks, TopPicksSkeleton } from "@/components/events/top-picks";
import { HeaderAction, SubPageHeader } from "@/components/ui/header";
import { PlusSquareIcon, SearchIcon } from "@/components/ui/icons";
import { CAMPUS_NAME } from "@/lib/brand";
import { getEventStore } from "@/lib/events/store";
import { RECORDED_QUESTION } from "@/lib/muse/fixtures/ask";

export default async function EventsTabPage() {
  await connection();
  const now = new Date();
  const events = await getEventStore().listEvents();

  return (
    <>
      <SubPageHeader
        title="Events"
        backHref="/home"
        backLabel="Back to Home"
        actions={
          <>
            <HeaderAction label="Create an event" Icon={PlusSquareIcon} href="/organizer" />
            <HeaderAction label="Ask Muse" Icon={SearchIcon} href="/ask" />
          </>
        }
      />
      <AskBar events={events} nowIso={now.toISOString()} placeholder={RECORDED_QUESTION} />
      <EventFeed
        events={events}
        nowIso={now.toISOString()}
        campus={CAMPUS_NAME}
        topPicks={
          <Suspense fallback={<TopPicksSkeleton />}>
            <TopPicks events={events} now={now} />
          </Suspense>
        }
      />
    </>
  );
}
