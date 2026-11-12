import type { Metadata } from "next";
import { ChipRow, LocationChip, StaticChip } from "@/components/ui/chips";
import { FbEventCard } from "@/components/ui/event-card";
import { HeaderAction, SubPageHeader } from "@/components/ui/header";
import { MoreCircleIcon, PlusSquareIcon, SearchIcon } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { SectionHeading } from "@/components/ui/section-heading";

// Facebook Events today: a faithful rebuild of the current Events tab, the
// fidelity benchmark and the "before" picture for the pitch. Every event,
// venue and count here is invented sample content. Header actions and chips
// are drawn but inert; only the back chevron goes somewhere.

export const metadata: Metadata = { title: "Facebook Events today" };

const SAMPLE_EVENTS = [
  {
    id: "sample-velvet-orchard",
    dateLine: "Fri, Mar 26, 2027 at 6\u202fPM PDT",
    title: "Velvet Orchard",
    venue: "Riverside Hall · Austin, TX",
    meta: "1.4K interested · 73 going",
    kicker: "Live, one night only",
  },
  {
    id: "sample-lantern-walk",
    dateLine: "Wed, Dec 16 at 4\u202fPM PST",
    title: "Eastside Lantern Walk and Night Market at Cedar Bend Park",
    venue: "Cedar Bend Park · Austin, TX",
    meta: "862 interested · 41 going",
    kicker: "Free admission",
  },
  {
    id: "sample-kite-day",
    dateLine: "Sat, Jan 9 at 11\u202fAM CST",
    title: "Winter Kite Day",
    venue: "Hilltop Green · Austin, TX",
    meta: "318 interested · 26 going",
    kicker: "Bring a kite or borrow one",
  },
];

export default function ReferenceEventsPage() {
  return (
    <>
      <SubPageHeader
        title="Events"
        backHref="/home"
        backLabel="Back to Home"
        actions={
          <>
            <HeaderAction label="Create" Icon={PlusSquareIcon} />
            <HeaderAction label="Search" Icon={SearchIcon} />
            <HeaderAction label="More" Icon={MoreCircleIcon} />
          </>
        }
      />
      <ChipRow label="Event filters">
        <LocationChip place="Menlo Park" />
        <StaticChip active>Top</StaticChip>
        <StaticChip>Local</StaticChip>
        <StaticChip>This week</StaticChip>
        <StaticChip>Friends</StaticChip>
        <StaticChip>Following</StaticChip>
      </ChipRow>
      <section className="pt-[21px]">
        <SectionHeading title="Top events for you" />
        <div className="mt-[7px] flex flex-col gap-[7.6px] px-3">
          {SAMPLE_EVENTS.map((event) => (
            <FbEventCard
              key={event.id}
              sharePath="/reference/events"
              image={<Poster seed={event.id} title={event.title} kicker={event.kicker} />}
              dateLine={event.dateLine}
              title={event.title}
              venue={event.venue}
              meta={event.meta}
              showMore
            />
          ))}
        </div>
      </section>
    </>
  );
}
