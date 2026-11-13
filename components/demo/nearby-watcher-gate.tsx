"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { NearbyWatcher } from "@/components/muse/nearby-watcher";
import { hidesNearbyOptIn } from "@/lib/demo/staged";

// Mounts the nearby alert watcher everywhere except screens where a person has
// no account yet (Lisa's invite, User 3's first curate), the demo's own screens,
// the organizer's screen, and any screen the /demo stage shows in its phone.
// Nobody in the pitch is asked about alerts unless the story calls for it.

const NO_NEARBY_EXTRA_ROOTS = ["/organizer"];

const noSubscribe = () => () => {};
// Inside the stage's phone (an iframe); on the server, assume so, so the banner never flashes.
const inStagePhone = () => window.self !== window.top;

export function NearbyWatcherGate() {
  const pathname = usePathname();
  const framed = useSyncExternalStore(noSubscribe, inStagePhone, () => true);
  const extra = pathname !== null && NO_NEARBY_EXTRA_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
  if (framed || extra || hidesNearbyOptIn(pathname)) return null;
  return <NearbyWatcher />;
}
