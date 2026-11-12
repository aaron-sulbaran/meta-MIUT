"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { CalendarIcon, MapPinIcon, MegaphoneIcon, SparkIcon } from "@/components/ui/icons";

type Tab = { href: string; label: string; Icon: ComponentType<{ className?: string }>; matches: (path: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Events", Icon: CalendarIcon, matches: (path) => path === "/" || path.startsWith("/events") },
  { href: "/map", label: "Map", Icon: MapPinIcon, matches: (path) => path.startsWith("/map") },
  { href: "/ask", label: "Ask Muse", Icon: SparkIcon, matches: (path) => path.startsWith("/ask") },
  { href: "/organizer", label: "Organizer", Icon: MegaphoneIcon, matches: (path) => path.startsWith("/organizer") },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-divider bg-card">
      {TABS.map(({ href, label, Icon, matches }) => {
        const active = matches(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 border-t-2 py-2 text-[11px] font-medium ${
              active ? "border-primary text-primary" : "border-transparent text-muted"
            }`}
          >
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
