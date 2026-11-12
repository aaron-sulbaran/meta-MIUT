import Link from "next/link";
import { SourceBadge } from "@/components/ui/card";
import { StarIcon } from "@/components/ui/icons";
import { loadSeedStudent } from "@/lib/events/seed";
import type { CampusEvent } from "@/lib/events/schema";
import { rankEvents } from "@/lib/muse/rank";

export async function TopPicks({ events, now }: { events: CampusEvent[]; now: Date }) {
  const ranking = await rankEvents(loadSeedStudent(), events, now);
  const eventsById = new Map(events.map((event) => [event.id, event]));

  return (
    <section className="bg-card px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
          <StarIcon className="h-5 w-5 text-primary" />
          Top 3 for you
        </h2>
        <SourceBadge source={ranking.source} />
      </div>
      {ranking.error !== null ? (
        <p className="text-[14px] text-muted">Could not rank events right now.</p>
      ) : (
        <ol className="-mx-4 flex gap-3 overflow-x-auto px-4">
          {ranking.data.map((pick, index) => {
            const event = eventsById.get(pick.eventId);
            if (!event) return null;
            return (
              <li key={pick.eventId} className="w-[240px] shrink-0">
                <Link href={`/events/${event.id}`} className="block h-full rounded-lg border border-divider p-3">
                  <p className="text-[12px] font-semibold text-primary">
                    #{index + 1} · {pick.walkMinutes} min walk
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-snug">{event.title}</p>
                  <p className="mt-1 text-[13px] text-muted">{pick.reason}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function TopPicksSkeleton() {
  return (
    <section className="bg-card px-4 pb-4 pt-3">
      <h2 className="mb-2 text-[17px] font-bold">Top 3 for you</h2>
      <p className="text-[14px] text-muted">Muse is picking...</p>
    </section>
  );
}
