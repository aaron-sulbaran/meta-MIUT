import type { CampusEvent } from "@/lib/events/schema";

// Logos for the MIT organizers in the demo seed, keyed by Instagram-style
// handle, each taken from the organizer's own public site (linked, not copied
// into this repo). The map prefers organizer.logoUrl when the event data has
// one; this list fills the gap until the seed carries logos itself. Organizers
// with no logo here (or a link that fails to load) show their monogram.
// MIT departments (Music and Theater Arts, CIS, ORSEL, Literature) use the MIT
// mark on their own sites, so that is their logo here too.

export const ORGANIZER_LOGOS: Record<string, string> = {
  mit_hsa: "https://web.mit.edu/hellenic/www/gifs/logo-title-smaller.gif",
  mit_mta: "https://mta.mit.edu/wp-content/uploads/2026/09/favicon-512x512-1-300x300.png",
  mit_cis: "https://cis.mit.edu/themes/cis/favicon.ico",
  mit_orsel: "https://studentlife.mit.edu/app/uploads/2025/01/favicon-512x512-1-300x300.png",
  mit_tsmit: "https://web.mit.edu/tsmit/www/TSMIT_logo/TSMIT_logo_2024_transparent.png",
  mit_energy_climate:
    "https://images.squarespace-cdn.com/content/v1/5812518015d5db0f10689afc/33a6ae01-67ff-442e-923f-9d80b3ebe666/favicon.ico?format=100w",
  mit_literature: "https://lit.mit.edu/wp-content/uploads/2023/10/favicon.svg",
  mit_ai_alignment: "https://mitaialignment.org/favicon.png",
  mit_mad: "https://design.mit.edu/favicon.ico",
  mit_lem: "https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/7/551/files/2024/05/2guyslogo_0.jpg",
  mit_capd: "https://cdn.uconnectlabs.com/wp-content/themes/uConnect_MIT/images/mit-capd-left.svg?v=2",
  mit_arts: "https://arts.mit.edu/wp-content/uploads/2015/12/cropped-AAM_Browser-Icon-192x192.png",
  mit_womens_league: "https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/c/1102/files/2024/11/cropped-favicon_5-192x192.png",
};

/** The organizer's logo: from the event data first, then the list above, else null. */
export function organizerLogo(organizer: CampusEvent["organizer"]): string | null {
  return organizer.logoUrl ?? ORGANIZER_LOGOS[organizer.handle.replace(/^@/, "").toLowerCase()] ?? null;
}
