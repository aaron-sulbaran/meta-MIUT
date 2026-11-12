import Link from "next/link";
import type { ReactNode } from "react";

// A section title row, as in "Top events for you" or "New for you  See all".
export function SectionHeading({
  title,
  seeAllHref,
  seeAllLabel = "See all",
  aside,
  id,
}: {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3">
      <h2 id={id} className="font-display text-title font-bold">
        {title}
      </h2>
      {seeAllHref ? (
        <Link href={seeAllHref} className="shrink-0 text-[14.5px] font-semibold text-link">
          {seeAllLabel}
        </Link>
      ) : (
        aside
      )}
    </div>
  );
}
