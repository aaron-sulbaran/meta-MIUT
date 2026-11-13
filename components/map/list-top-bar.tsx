import Link from "next/link";
import { ViewToggle } from "@/components/map/view-toggle";

// The List view's top bar, laid out exactly like the map's: For you and Free
// on the upper left, the Map/List toggle on the upper right. The chip lives in
// the URL (?view=list&chip=free) so the server renders the right list.

export type ListChip = "forYou" | "free";

const CHIPS: { id: ListChip; label: string; href: string }[] = [
  { id: "forYou", label: "For you", href: "/?view=list" },
  { id: "free", label: "Free", href: "/?view=list&chip=free" },
];

export function ListTopBar({ chip }: { chip: ListChip }) {
  return (
    <div className="relative h-[52px]">
      <nav aria-label="Filter events" className="absolute left-3 top-3 z-10 flex gap-[6px]">
        {CHIPS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={chip === item.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-[12px] py-[6px] text-meta font-semibold shadow-sm ${
              chip === item.id ? "bg-ink text-white" : "bg-card text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <ViewToggle view="list" overlay />
    </div>
  );
}
