"use client";

import { usePathname } from "next/navigation";
import { NearbyWatcher } from "@/components/muse/nearby-watcher";
import { hidesNearbyOptIn } from "@/lib/demo/staged";

// Mounts the nearby alert watcher everywhere except screens where a person has
// no account yet (Lisa's invite, User 3's first curate) and the demo's own
// screens. Nobody is asked about alerts before they have an account.
export function NearbyWatcherGate() {
  const pathname = usePathname();
  if (hidesNearbyOptIn(pathname)) return null;
  return <NearbyWatcher />;
}
