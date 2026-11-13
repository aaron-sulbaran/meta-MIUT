// The demo student's walk home (beat U1b): where home is, and the exact crawl request
// the map's Muse card sends for it, so the stage's head start asks the same question
// (lib/demo/head-start.ts). Client safe.

export type WalkPoint = { lat: number; lng: number };

// Home for the demo student until the profile carries a dorm (the same spot the crawl planner uses).
export const WALK_HOME = { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934 } as const;

/** The walk home request, as components/map/muse-conversation.tsx sends it. */
export function walkHomeRequest(from: WalkPoint, atIso: string) {
  return {
    from: { lat: from.lat, lng: from.lng },
    to: { lat: WALK_HOME.lat, lng: WALK_HOME.lng },
    toLabel: WALK_HOME.name,
    mode: "walk" as const,
    at: atIso,
    exclude: [] as string[],
  };
}
