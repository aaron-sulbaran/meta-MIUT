import Link from "next/link";

// Map or List for the Events tab. Map is the default view.

export function ViewToggle({ view, overlay = false }: { view: "map" | "list"; overlay?: boolean }) {
  const item = (active: boolean) =>
    `rounded-full px-[12px] py-[5px] text-meta font-semibold ${active ? "bg-primary text-on-primary" : "text-ink"}`;
  return (
    <nav
      aria-label="Events view"
      className={`flex gap-[2px] rounded-full bg-card p-[3px] ${overlay ? "absolute right-3 top-3 z-10 shadow-sm" : "mx-3 mt-3 w-fit border border-hairline"}`}
    >
      <Link href="/" aria-current={view === "map" ? "page" : undefined} className={item(view === "map")}>
        Map
      </Link>
      <Link href="/?view=list" aria-current={view === "list" ? "page" : undefined} className={item(view === "list")}>
        List
      </Link>
    </nav>
  );
}
