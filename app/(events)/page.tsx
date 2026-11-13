import { connection } from "next/server";
import { Suspense } from "react";
import { EventFeed } from "@/components/events/event-feed";
import { TopPicks, TopPicksSkeleton } from "@/components/events/top-picks";
import { ListTopBar, type ListChip } from "@/components/map/list-top-bar";
import { MapHome, MapHomeSkeleton } from "@/components/map/map-home";
import { ViewToggle } from "@/components/map/view-toggle";
import { HeaderAction, SubPageHeader } from "@/components/ui/header";
import { PlusSquareIcon, SearchIcon } from "@/components/ui/icons";
import { CAMPUS_NAME } from "@/lib/brand";
import { getEventStore } from "@/lib/events/store";

// The Events tab opens on the map (lisa, t-94t4). The feed is one tap away as
// List (?view=list). Both views share one top bar: For you and Free on the
// upper left, Map/List on the upper right. Ask Muse stays one tap away in the
// header (the search icon).
export default async function EventsTabPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; chip?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "map";
  const listChip: ListChip = params.chip === "free" ? "free" : "forYou";
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
      {view === "map" ? (
        <div className="relative">
          <Suspense fallback={<MapHomeSkeleton />}>
            <MapHome events={events} now={now} />
          </Suspense>
          <ViewToggle view="map" overlay />
        </div>
      ) : (
        <>
          <ListTopBar chip={listChip} />
          <EventFeed
            key={listChip}
            events={events}
            nowIso={now.toISOString()}
            campus={CAMPUS_NAME}
            initialChip={listChip}
            showChips={false}
            topPicks={
              <Suspense fallback={<TopPicksSkeleton />}>
                <TopPicks events={events} now={now} />
              </Suspense>
            }
          />
        </>
      )}
    </>
  );
}
