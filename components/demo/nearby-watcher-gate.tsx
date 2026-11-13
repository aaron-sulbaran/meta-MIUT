"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MUSE_CARD } from "@/components/map/muse-conversation";
import { NearbyWatcher } from "@/components/muse/nearby-watcher";
import { hidesNearbyOptIn } from "@/lib/demo/staged";

// Mounts the nearby alert watcher everywhere except screens where a person has
// no account yet (Lisa's invite, User 3's first curate), the demo's own screens,
// the organizer's screen, and any screen the /demo stage shows in its phone.
// Nobody in the pitch is asked about alerts unless the story calls for it. Never while the
// Muse card is up on the map (it would cover the mic).

const NO_NEARBY_EXTRA_ROOTS = ["/organizer"];

const noSubscribe = () => () => {};
// Inside the stage's phone (an iframe); on the server, assume so, so the banner never flashes.
const inStagePhone = () => window.self !== window.top;

export function NearbyWatcherGate() {
  const pathname = usePathname();
  // Never over the Muse card on the map: the nudge would sit on its mic.
  // Screens that open with the Muse card (the map's alert path, ?plan=home) start with the nudge
  // hidden, before the card has said anything; the card says when it closes.
  const [museCard, setMuseCard] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("plan") === "home",
  );
  useEffect(() => {
    const onCard = (event: Event) => setMuseCard((event as CustomEvent<boolean>).detail === true);
    window.addEventListener(MUSE_CARD, onCard);
    return () => window.removeEventListener(MUSE_CARD, onCard);
  }, []);
  const framed = useSyncExternalStore(noSubscribe, inStagePhone, () => true);
  const extra = pathname !== null && NO_NEARBY_EXTRA_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
  if (framed || extra || museCard || hidesNearbyOptIn(pathname)) return null;
  return <NearbyWatcher />;
}
