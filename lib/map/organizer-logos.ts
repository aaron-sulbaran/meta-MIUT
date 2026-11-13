import type { CampusEvent } from "@/lib/events/schema";
import { generatedLogo } from "@/lib/map/generated-logo";
import { LOCAL_LOGO_FILES } from "@/lib/map/organizer-logo-files";

// Logos for the organizers in the demo and test seeds, keyed by Instagram-style
// handle, each taken from the organizer's own public site (linked, not copied
// into this repo). The map prefers organizer.logoUrl when the event data has
// one; this list fills the gap until the seed carries logos itself. Organizers
// with no logo anywhere get one generated from their name (generated-logo.ts);
// a link that fails to load still shows their monogram.
// MIT departments (Music and Theater Arts, CIS, ORSEL, Literature) use the MIT
// mark on their own sites, so that is their logo here too.

// The MIT mark, as Student Life serves it.
const STUDENT_LIFE = "https://studentlife.mit.edu/app/uploads/2025/01/favicon-512x512-1-300x300.png";
const BU = "https://www.bu.edu/home/img/apple-touch-icon-precomposed.png";
const NORTHEASTERN = "https://brand.northeastern.edu/global/assets/favicon/apple-touch-180x180.png?v=2";
const HARVARD = "https://www.harvard.edu/wp-content/uploads/2020/10/cropped-logo-branding-compressed.png?w=192";

export const ORGANIZER_LOGOS: Record<string, string> = {
  mit_hsa: "https://web.mit.edu/hellenic/www/gifs/logo-title-smaller.gif",
  mit_mta: "https://mta.mit.edu/wp-content/uploads/2026/09/favicon-512x512-1-300x300.png",
  mit_cis: "https://cis.mit.edu/themes/cis/favicon.ico",
  mit_orsel: STUDENT_LIFE,
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
  mit_ua: "https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/b/496/files/2025/03/cropped-UALogoFullColor-192x192.png",
  mit_sao: STUDENT_LIFE,
  mit_eecs: "https://www.eecs.mit.edu/wp-content/uploads/2021/06/cropped-cropped-favicon-192x192.png",
  mit_mtg: "https://mtg.mit.edu/static/images/mtg.png",
  mit_csc: "https://csc.mit.edu/favicon.ico",
  simmons_hall: "https://simmons.mit.edu/favicon.png",
  bakerhouse: "https://baker.mit.edu/favicon/apple-touch-icon.png",
  sloan_eclub: "https://mitsloan.mit.edu/favicon-32x32.png",
  kendallsq: "https://kendallsquare.org/wp-content/uploads/cropped-ksa_icon_darkgreen_rgb_720-192x192.png",
  centralsq: "https://i0.wp.com/centralsquare.org/wp-content/uploads/2021/06/cropped-logo-color-reversed-1.png?fit=192%2C192&ssl=1",
  cstheater: "https://www.centralsquaretheater.org/wp-content/uploads/2023/03/cropped-cst-purple-logo-2023-192x192.png",
  harvard_uc: HARVARD,
  harvardfilm: HARVARD,
  mitsloan_eclub: "https://mitsloan.mit.edu/favicon-32x32.png",
  csail_students: "https://www.csail.mit.edu/themes/custom/csail/images/favicon.ico",
  harvardhcs: "https://hcs.harvard.edu/logo.png",
  harvardseas: "https://seas.harvard.edu/themes/custom/seas/favicon.ico",
  harvardkroks:
    "https://static.wixstatic.com/media/0a963c_394d8a6268ff4e8fb372b7ce1f41ab95%7Emv2.png/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/0a963c_394d8a6268ff4e8fb372b7ce1f41ab95%7Emv2.png",
  harvardmc: HARVARD,
  hackharvard: "https://hackharvard.io/assets/img/apple-touch-icon.png",
  berkleejazz: "https://www.berklee.edu/themes/custom/berklee_base/favicon.ico",
  bu_climbing: BU,
  bu_filmsoc: BU,
  bu_isso: BU,
  bu_sao: BU,
  neu_hacks: NORTHEASTERN,
  nu_jcc: NORTHEASTERN,
  nu_tabletop: NORTHEASTERN,
  cambridgepl: "https://www.cambridgema.gov/apple-icon-180x180.png",
  centralarts: "https://i0.wp.com/centralsquare.org/wp-content/uploads/2021/06/cropped-logo-color-reversed-1.png?fit=192%2C192&ssl=1",
  mccormick_mit: STUDENT_LIFE,
  // MIT groups without a logo of their own online (or, for the MIT Museum, a
  // site that turns automated requests away) show the MIT mark.
  mit_outing: STUDENT_LIFE,
  mit_tango: STUDENT_LIFE,
  macgregor_house: STUDENT_LIFE,
  mit_classcouncil: STUDENT_LIFE,
  mit_acappella: STUDENT_LIFE,
  mit_hacks: STUDENT_LIFE,
  mit_museum: STUDENT_LIFE,
  mitmuseum: STUDENT_LIFE,
};

/**
 * The organizer's logo: from the event data first, then the list above, else one generated for them.
 * A logo with a local copy (organizer-logo-files.ts) is served from this site.
 */
export function organizerLogo(organizer: CampusEvent["organizer"]): string {
  const logo = organizer.logoUrl ?? ORGANIZER_LOGOS[organizer.handle.replace(/^@/, "").toLowerCase()] ?? generatedLogo(organizer.name);
  return LOCAL_LOGO_FILES[logo] ?? logo;
}
