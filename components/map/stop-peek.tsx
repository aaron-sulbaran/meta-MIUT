"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { MapCard } from "@/components/map/events-map";
import { CATEGORY_TINTS, monogram } from "@/components/map/category-icons";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { posterStyle } from "@/components/ui/poster";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { arrivesTooLate, type Point, type RouteStop } from "@/lib/map/crawl-route";

// A food crawl stop, peeked from the map: tap a numbered stop and this card
// floats just above it with a pointer down at the number (Lisa). The flyer (or
// poster) with the organizer's logo, a "Stop 1 · Main" chip, the title, when to
// get there and how long it runs, the place, what is free, and Open event and
// Directions. The map places it (events-map.tsx); this only draws it.

const KIND_LABELS: Record<string, string> = {
  main: "Main",
  dessert: "Dessert",
  drinks: "Drinks",
  snack: "Snack",
  merch: "Merch",
  event: "Event",
  plan: "Your stop",
  added: "Added",
};

export const PEEK_WIDTH = 272;
/** About how tall the card is, so the map can make room above a stop. */
export const PEEK_HEIGHT = 240;

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

function walkingTo(from: Point, to: Point): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function Row({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "free" | "late" }) {
  const color = tone === "free" ? "text-[#1e6b33]" : tone === "late" ? "text-badge" : "text-muted";
  return <p className={`truncate text-[12.5px] font-semibold leading-[17px] ${color}`}>{children}</p>;
}

/** A stand-in flyer: the event's poster colors with its title, for events without one. */
function MiniFlyer({ seed, title }: { seed: string; title: string }) {
  const { palette } = posterStyle(seed);
  return (
    <div className="flex h-full w-full flex-col justify-between p-[7px]" style={{ background: palette.field, color: palette.ink }}>
      <span className="line-clamp-5 font-display text-[11px] font-extrabold leading-[12.5px] tracking-[-0.01em]">{title}</span>
      <span className="h-[8px] w-full rounded-full" style={{ background: palette.shape }} />
    </div>
  );
}

export function StopPeek({
  number,
  stop,
  card,
  from,
  left,
  top,
  pointerLeft,
  onClose,
}: {
  number: number;
  stop: RouteStop;
  card: MapCard | undefined;
  /** Where the walk to this stop starts, for directions. */
  from: Point;
  /** Where the card sits inside the map (top is its bottom edge, just above the stop), and where along it the pointer sits. */
  left: number;
  top: number;
  pointerLeft: number;
  onClose: () => void;
}) {
  // Escape closes the peek.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tint = card ? CATEGORY_TINTS[card.category] : { fill: "#e6f1fb", ink: "#0c447c" };
  const late = arrivesTooLate(stop);
  const kind = KIND_LABELS[stop.kind] ?? "Stop";

  return (
    <div
      role="dialog"
      aria-label={`Stop ${number}: ${stop.title}`}
      className="absolute z-30"
      style={{ left, top, width: PEEK_WIDTH, transform: "translateY(-100%)" }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative rounded-[18px] bg-card p-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-black/5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[6px] top-[6px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-muted hover:bg-wash"
        >
          <CloseIcon className="h-[12px] w-[12px]" />
        </button>

        <div className="flex gap-[10px] pr-[18px]">
          <div className="relative h-[100px] w-[76px] shrink-0">
            <div className="h-full w-full overflow-hidden rounded-[12px] bg-wash shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
              {card?.imagePath ? (
                // Flyers are local files or small stored images; a plain img keeps both working.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.imagePath} alt="" className="h-full w-full object-cover" />
              ) : (
                <MiniFlyer seed={stop.eventId ?? stop.title} title={stop.title} />
              )}
            </div>
            <span
              className="absolute -bottom-[5px] -right-[5px] flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white text-[8px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
              style={card?.logoUrl ? undefined : { background: tint.fill, color: tint.ink }}
              aria-hidden
            >
              {card?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.logoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-[2px]" />
              ) : (
                monogram(card?.organizerName ?? stop.title)
              )}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex h-[20px] items-center rounded-full bg-[#e3f4e6] px-[8px] text-[11px] font-bold text-[#1e6b33]">
              Stop {number} · {kind}
            </span>
            <h3 className="mt-[3px] line-clamp-2 font-display text-[14px] font-bold leading-[17px] text-ink">{stop.title}</h3>
            {card?.organizerName && <p className="truncate text-[11.5px] text-muted">by {card.organizerName}</p>}
          </div>
        </div>

        <div className="mt-[8px] flex flex-col gap-[1px]">
          <Row>
            Arrive {clock(stop.arriveAt)} · {stop.walkMinutes} min {stop.mode === "walk" ? "walk" : stop.mode}
          </Row>
          {stop.endsAt && <Row>Open until {clock(stop.endsAt)}</Row>}
          {late && <Row tone="late">Ends before you get there</Row>}
          <p className="flex items-center gap-[4px] truncate text-[12.5px] font-semibold leading-[17px] text-muted">
            <MapPinIcon className="h-[13px] w-[13px] shrink-0" />
            <span className="truncate">{stop.placeName}</span>
          </p>
          {card?.free && <Row tone="free">{card.perk ? `Free: ${card.perk}` : "Free"}</Row>}
        </div>

        <div className="mt-[9px] flex gap-[6px]">
          {stop.eventId ? (
            <Link href={`/events/${stop.eventId}`} className="flex-1 rounded-[10px] bg-primary py-[7px] text-center text-[13px] font-bold text-on-primary">
              Open event
            </Link>
          ) : null}
          <a
            href={walkingTo(from, stop)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-[10px] bg-wash py-[7px] text-center text-[13px] font-bold text-ink"
          >
            Directions
          </a>
        </div>
      </div>
      {/* The pointer down at the stop's number. */}
      <span
        aria-hidden
        className="absolute bottom-[-7px] h-[14px] w-[14px] rotate-45 rounded-[3px] bg-card shadow-[3px_3px_6px_rgba(0,0,0,0.08)]"
        style={{ left: pointerLeft - 7 }}
      />
    </div>
  );
}
