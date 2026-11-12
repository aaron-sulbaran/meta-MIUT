import type { ReactNode } from "react";
import { MapPinIcon } from "@/components/ui/icons";

// The chip row under a Facebook header: a grey location chip, then filter
// chips where the active one sits on a blue tint and the rest have no fill.
// The row scrolls sideways with no visible scrollbar.

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar flex gap-[7.6px] overflow-x-auto px-[11.5px] pt-[7px]">
      {children}
      <span aria-hidden className="w-[4px] shrink-0" />
    </div>
  );
}

const chipBase = "flex h-[35px] shrink-0 items-center rounded-full px-[12.3px] font-display text-[13.6px] leading-[17px] font-bold tracking-[-0.005em] whitespace-nowrap";

/** States where the list is, not a control. */
export function LocationChip({ place }: { place: string }) {
  return (
    <span className={`${chipBase} gap-[8px] bg-field pl-[12px] text-ink`}>
      <MapPinIcon className="h-[17px] w-[17px] shrink-0" />
      {place}
    </span>
  );
}

export function FilterChip({
  children,
  active,
  onSelect,
}: {
  children: ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`${chipBase} ${active ? "bg-primary-soft text-link" : "text-ink"}`}
    >
      {children}
    </button>
  );
}

/** A chip drawn for fidelity on the reference screen; not interactive. */
export function StaticChip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`${chipBase} ${active ? "bg-primary-soft text-link" : "text-ink"}`}>{children}</span>;
}
