import { MapHomeSkeleton } from "@/components/map/map-home";
import { SubPageHeader } from "@/components/ui/header";

// Shown the moment Events is tapped, while the server renders the map or list.
export default function EventsLoading() {
  return (
    <>
      <SubPageHeader title="Events" backHref="/home" backLabel="Back to Home" />
      <MapHomeSkeleton />
    </>
  );
}
