import { connection } from "next/server";
import { Suspense } from "react";
import { MapHome, MapHomeSkeleton } from "@/components/map/map-home";
import { SubPageHeader } from "@/components/ui/header";
import { getEventStore } from "@/lib/events/store";

export default async function MapPage() {
  await connection();
  const now = new Date();
  const events = await getEventStore().listEvents();
  return (
    <>
      <SubPageHeader title="Map" backHref="/" backLabel="Back to Events" />
      <Suspense fallback={<MapHomeSkeleton />}>
        <MapHome events={events} now={now} />
      </Suspense>
    </>
  );
}
