import { PRODUCT_NAME } from "@/lib/brand";
import { BellIcon, SearchIcon } from "@/components/ui/icons";

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-divider bg-card px-4">
      <span className="text-[22px] font-bold tracking-tight text-primary">{PRODUCT_NAME}</span>
      <div className="flex gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wash" aria-label="Search">
          <SearchIcon className="h-5 w-5" />
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wash" aria-label="Notifications">
          <BellIcon className="h-5 w-5" />
        </span>
      </div>
    </header>
  );
}
