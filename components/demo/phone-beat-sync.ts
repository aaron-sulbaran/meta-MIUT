"use client";

import { useEffect, useRef } from "react";
import { BEATS } from "@/lib/demo/beats";

// For a screen that stays put across two beats (the Instagram post is O1 and
// O2): calls `onBeat` with the beat id when the show moves, so the screen can
// show that beat's state although nobody tapped it here. Two ways in: the /demo
// stage announces its moves on the "demo-stage" BroadcastChannel (its own phone
// frame hears them), and a presenter phone (/demo/phone/<slug>) posts
// { type: "demo-beat", id } into its screen.
export function useStageBeat(onBeat: (id: string) => void) {
  const handler = useRef(onBeat);
  useEffect(() => {
    handler.current = onBeat;
  });
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("demo-stage");
    if (channel) {
      channel.onmessage = (message: MessageEvent<{ type?: unknown; index?: unknown }>) => {
        const id = message.data?.type === "goto" && typeof message.data.index === "number" ? BEATS[message.data.index]?.id : undefined;
        if (id) handler.current(id);
      };
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { type?: unknown; id?: unknown } | null;
      if (data?.type === "demo-beat" && typeof data.id === "string") handler.current(data.id);
    };
    window.addEventListener("message", onMessage);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
    };
  }, []);
}
