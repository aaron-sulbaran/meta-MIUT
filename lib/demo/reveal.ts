// When the stage shows a screen it has just put in its phone (components/demo/stage.tsx).
// The old screen stays up until one of these is true, so a cut never shows a blank frame:
// - the page is parsed and painted (an ordinary screen; not a held one, see below),
// - the page's load event fired (every image in it settled),
// - the page said so itself ({source: "demo-screen", type: "ready"}),
// - REVEAL_CEILING_MS passed since the screen was put in. An image that hangs on a slow outside
//   site (a logo, a map tile) or a page still streaming must never keep the last screen up.
// A held screen (loaded ahead, Beat.prefetchPath) waits for load or ready so its "reveal"
// message reaches a page that is listening; past the ceiling it shows anyway, and the stage
// sends "reveal" again when load does fire.

/** Measured on U3b: the parsed map paints in 0.3 to 0.5 s locally; 2 s covers a slow venue network. */
export const REVEAL_CEILING_MS = 2_000;

export type RevealSignals = {
  /** The page is parsed (readyState past "loading") and its body has content. */
  domReady: boolean;
  /** The iframe's load event fired. */
  loaded: boolean;
  /** The page posted {source: "demo-screen", type: "ready"}. */
  screenReady: boolean;
  /** Milliseconds since the screen was put in the phone. */
  elapsedMs: number;
  /** A held screen waiting to be told "reveal". */
  held: boolean;
};

export function shouldReveal(signals: RevealSignals, ceilingMs = REVEAL_CEILING_MS): boolean {
  if (signals.loaded || signals.screenReady) return true;
  if (signals.elapsedMs >= ceilingMs) return true;
  return !signals.held && signals.domReady;
}
