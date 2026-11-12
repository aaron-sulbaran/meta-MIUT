import Link from "next/link";
import type { ReactNode } from "react";
import { InterestedButton, ShareButton } from "@/components/ui/event-actions";
import { MoreDotsIcon } from "@/components/ui/icons";

// The event card as the Facebook app draws it today: a 2:1 image, a grey date
// line, a bold title, the venue, one grey meta line, then a full-width grey
// Interested button and a square share button.

export type FbEventCardProps = {
  /** Where the card opens. Omit for a card that only shows (the reference screen). */
  href?: string;
  /** What the share button shares; defaults to href. */
  sharePath?: string;
  image: ReactNode;
  dateLine: string;
  title: string;
  venue: string;
  meta?: ReactNode;
  /** Draws the dark more button over the image. Reference screen only: it is inert. */
  showMore?: boolean;
};

export function FbEventCard({ href, sharePath, image, dateLine, title, venue, meta, showMore = false }: FbEventCardProps) {
  const body = (
    <>
        <div className="relative">
          {image}
          {showMore && (
            <span
              aria-hidden
              className="absolute right-[7.6px] top-[8.1px] flex h-[31px] w-[31px] items-center justify-center rounded-full bg-scrim text-white"
            >
              <MoreDotsIcon className="h-[31px] w-[31px]" />
            </span>
          )}
        </div>
        <div className="px-[11.3px] pt-[12px]">
          <p className="text-meta font-semibold text-muted">{dateLine}</p>
          <h3 className="mt-[4px] font-display text-label font-bold">{title}</h3>
          <p className="mt-[1px] text-venue font-semibold text-ink">{venue}</p>
          {meta && <p className="mt-[3px] text-meta font-semibold text-muted">{meta}</p>}
        </div>
    </>
  );
  return (
    <article className="overflow-hidden rounded-card border border-hairline bg-card">
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      <div className="flex gap-[7.6px] px-[11.3px] pb-[11.7px] pt-[9px]">
        <InterestedButton className="flex-1" />
        <ShareButton path={sharePath ?? href ?? "/"} title={title} />
      </div>
    </article>
  );
}
