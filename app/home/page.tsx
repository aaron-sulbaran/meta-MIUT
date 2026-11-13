import Link from "next/link";
import { connection } from "next/server";
import { eventFacts, posterKicker } from "@/components/events/event-card";
import { FeedPosts } from "@/components/home/feed-posts";
import { SideMenu } from "@/components/home/side-menu";
import { MapPreload } from "@/components/map/map-preload";
import { FeedSeparator } from "@/components/ui/card";
import { FbEventCard } from "@/components/ui/event-card";
import { HeaderAction, HomeHeader, getFacebookHref } from "@/components/ui/header";
import { ChatBoltIcon, PhotoIcon, PlusSquareIcon, SearchIcon } from "@/components/ui/icons";
import { Poster } from "@/components/ui/poster";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProfileAvatar } from "@/components/ui/tab-bar";
import { filterEvents, formatDateLine } from "@/lib/events/time";
import { getEventStore } from "@/lib/events/store";

// The Home feed shell. Events lead the feed where stories sit today.

export default async function HomePage() {
  await connection();
  const now = new Date();
  const events = await getEventStore().listEvents();
  const today = filterEvents(events, { window: "today", freeOnly: false, now });
  const shared = today.find((event) => event.source.kind === "instagram" && event.source.caption);

  return (
    <>
      <MapPreload />
      <HomeHeader
        wordmark="facebook"
        menu={<SideMenu />}
        actions={
          <>
            <HeaderAction label="Create an event" Icon={PlusSquareIcon} href="/organizer" />
            <HeaderAction label="Ask Muse" Icon={SearchIcon} href="/ask" />
            <HeaderAction label="Messages" Icon={ChatBoltIcon} href={getFacebookHref("messenger")} iconClass="h-[24px] w-[24px]" />
          </>
        }
      />

      <div className="flex items-center gap-[9px] px-[11.4px] pb-[14px] pt-[10px]">
        <Link href={getFacebookHref("profile")} aria-label="Your profile">
          <ProfileAvatar size={39} />
        </Link>
        <Link
          href={getFacebookHref("post")}
          className="flex h-[38px] flex-1 items-center rounded-full bg-wash px-[14px] text-body font-semibold"
        >
          What&apos;s on your mind?
        </Link>
        <Link href={getFacebookHref("post")} aria-label="Photo" className="mr-[5.9px] text-muted">
          <PhotoIcon className="h-[24px] w-[24px]" />
        </Link>
      </div>

      <section aria-labelledby="home-events-heading" className="pb-[16px]">
        <SectionHeading id="home-events-heading" title="Events for you" seeAllHref="/" />
        <ul className="no-scrollbar mt-[10px] flex snap-x snap-mandatory gap-[7.6px] overflow-x-auto scroll-px-3 px-3">
          {today.map((event) => (
            <li key={event.id} className="w-[168px] shrink-0 snap-start">
              <Link
                href={`/events/${event.id}`}
                className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card"
              >
                <Poster seed={event.id} title={event.title} size="small" imagePath={event.source.imagePath} />
                <div className="px-[9px] pb-[10px] pt-[8px]">
                  <p className="truncate text-meta font-semibold text-muted">{formatDateLine(event, now)}</p>
                  <h3 className="mt-[2px] line-clamp-2 font-display text-label font-bold">{event.title}</h3>
                  <p className="mt-[2px] truncate text-meta font-semibold text-muted">{eventFacts(event)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FeedSeparator />

      {shared && shared.source.caption && (
        <article className="pt-[11px]">
          <div className="flex items-center gap-[9px] px-[11.4px]">
            <span
              aria-hidden
              className="flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-[9px] bg-[#1c2b33] font-display text-[17px] font-bold text-white"
            >
              {shared.organizer.name.replace(/^Sample /, "").charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-label font-bold">{shared.organizer.name}</p>
              <p className="text-meta font-semibold text-muted">Shared an event</p>
            </div>
          </div>
          <p className="px-[11.4px] pt-[10px] text-body font-medium">{shared.source.caption}</p>
          <div className="px-3 pt-[10px]">
            <FbEventCard
              href={`/events/${shared.id}`}
              image={<Poster seed={shared.id} title={shared.title} kicker={posterKicker(shared)} imagePath={shared.source.imagePath} />}
              dateLine={formatDateLine(shared, now)}
              title={shared.title}
              venue={shared.place.name}
              meta={eventFacts(shared)}
            />
          </div>
        </article>
      )}
      {shared && shared.source.caption && <FeedSeparator />}

      <FeedPosts />
    </>
  );
}
