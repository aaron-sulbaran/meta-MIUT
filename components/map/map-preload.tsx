"use client";

import { useEffect } from "react";
import { preconnect } from "react-dom";
import { MAP_STYLE_URL } from "@/components/map/map-style";

// Warms the map before Events is tapped: fetches the MapLibre script and the
// tile style while the student is still on another screen.
export function MapPreload() {
  preconnect("https://tiles.openfreemap.org");
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 300));
    idle(() => {
      void import("maplibre-gl");
      void fetch(MAP_STYLE_URL).catch(() => {});
    });
  }, []);
  return null;
}
