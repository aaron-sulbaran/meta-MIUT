import { PageSkeleton } from "@/components/ui/page-skeleton";

// The organizer layout already draws the header.
export default function OrganizerLoading() {
  return <PageSkeleton rows={2} />;
}
