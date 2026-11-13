import { connection } from "next/server";
import { Suspense } from "react";
import { EventFeed } from "@/components/events/event-feed";
import { TopPicks, TopPicksSkeleton } from "@/components/events/top-picks";
import { ListTopBar, type ListChip } from "@/components/map/list-top-bar";
import { AppSwitch } from "@/components/demo/app-switch";
import { FirstVisit } from "@/components/curate/first-visit";
import { MapHome, MapHomeSkeleton } from "@/components/map/map-home";
import { ListMuseMenu, MuseHeaderButton } from "@/components/map/muse-menu";
import { ViewToggle } from "@/components/map/view-toggle";
import { HeaderAction, SubPageHeader } from "@/components/ui/header";
import { PlusSquareIcon } from "@/components/ui/icons";
import { CAMPUS_NAME } from "@/lib/brand";
import { REPLAN_LINE } from "@/lib/demo/staged";
import { getEventStore } from "@/lib/events/store";

// The Events tab opens on the map (lisa, t-94t4). The feed is one tap away as
// List (?view=list). Both views share one top bar: For you and Free on the
// upper left, Map/List on the upper right. Sprout, the Muse character, sits in
// the header where the search icon was: on the Map and the List it opens the
// Muse menu (Ask Muse, Freebie Crawl); from the List, both open the map
// (/?muse=ask with the Ask popup up, /?plan=crawl with the planner up). /?plan=home opens the map with Muse's walk from
// class to home planned (the "just out of class" alert links here); ?time=<ISO>
// plans every walk from a set campus time, for the demo (?at= is the nearby
// watcher's simulated location). ?auto=1 (the demo's U1c) has Ask Muse ask the
// scripted re-plan line on its own, as typed text; the real ask call still runs.
// ?reveal=wait (the stage loading U1b ahead) holds Muse's reveal until the stage posts {type: "reveal"}.
// ?first=1 is a first visit to Events (the demo's U3b, opened from Instagram with ?opened=instagram,
// which plays the app switch): the plain map, then Muse asks before building her feed
// (components/curate/first-visit.tsx, &step=ask or &step=read to start further on), then
// the List (?view=list&first=1) with her own Top 3.
export default async function EventsTabPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; chip?: string; plan?: string; time?: string; note?: string; to?: string; invite?: string; auto?: string; reveal?: string; muse?: string; first?: string; opened?: string; step?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "map";
  const listChip: ListChip = params.chip === "free" ? "free" : "forYou";
  const now = new Date();
  const events = await getEventStore().listEvents();
  const firstVisit = params.first === "1";

  return (
    <AppSwitch from={params.opened}>
      <SubPageHeader
        title="Events"
        backHref="/home"
        backLabel="Back to Home"
        actions={
          <>
            <HeaderAction label="Create an event" Icon={PlusSquareIcon} href="/organizer" />
            <MuseHeaderButton />
          </>
        }
      />
      {view === "map" ? (
        <div className="relative">
          <Suspense fallback={<MapHomeSkeleton />}>
            <MapHome
              events={events}
              now={now}
              autoPlan={params.plan === "home" ? "home" : params.plan === "crawl" ? "choose" : null}
              askPlan={
                params.plan === "ask" && params.note
                  ? { note: params.note.slice(0, 300), toEventId: params.to ?? null, invite: params.invite === "1" }
                  : null
              }
              autoAsk={params.auto === "1" ? REPLAN_LINE : null}
              holdReveal={params.reveal === "wait"}
              openAsk={params.muse === "ask"}
              planAt={params.time && Number.isFinite(Date.parse(params.time)) ? params.time : null}
            />
          </Suspense>
          <ViewToggle view="map" overlay />
          {firstVisit && (
            <FirstVisit
              startStep={params.step === "ask" || params.step === "read" ? params.step : null}
              openedFromApp={params.opened === "instagram"}
            />
          )}
        </div>
      ) : (
        <>
          {/* Sprout's menu on the List: the same Ask Muse and Freebie Crawl as on the map. */}
          <ListMuseMenu />
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
                <TopPicks events={events} now={now} firstVisit={firstVisit} />
              </Suspense>
            }
          />
        </>
      )}
    </AppSwitch>
  );
}
