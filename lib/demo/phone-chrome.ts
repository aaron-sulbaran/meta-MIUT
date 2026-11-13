import type { Beat, StagedScreen } from "@/lib/demo/beats";

// How the stage's drawn phone treats each screen (components/demo/phone-frame.tsx).
// Client safe.
//
// "inset": the app is laid out below the status bar, the way iOS hands an app
// its safe area, so nothing of it sits in the top corners. It still runs under
// the home indicator at the bottom, as iOS apps do (the floating tab bar sits
// above it). "full-bleed": the screen fills the glass and draws its own top
// area (a lock screen, the staged Instagram screens), with the bar over it.

export type PhoneChrome = {
  layout: "inset" | "full-bleed";
  /** Dark glyphs on a light screen, light glyphs on a dark one. */
  tone: "dark" | "light";
  /** The Lock Screen shows its own large clock, so the bar leaves the time out. */
  showTime: boolean;
  /** Fills the status bar area behind an inset app. */
  background: string;
};

export const APP_CHROME: PhoneChrome = { layout: "inset", tone: "dark", showTime: true, background: "#ffffff" };

const STAGED_CHROME: Record<StagedScreen, PhoneChrome> = {
  // Instagram's staged screens keep a status bar's worth of room at the top.
  "instagram-new-post": { layout: "full-bleed", tone: "dark", showTime: true, background: "#ffffff" },
  "instagram-crosspost-prompt": { layout: "full-bleed", tone: "dark", showTime: true, background: "#ffffff" },
  "instagram-feed-prompt": { layout: "full-bleed", tone: "dark", showTime: true, background: "#ffffff" },
  "invite-message": { layout: "full-bleed", tone: "dark", showTime: true, background: "#ffffff" },
  "live-activity": { layout: "full-bleed", tone: "light", showTime: false, background: "#10204a" },
};

/** The phone chrome for a beat. A staged beat whose route is missing shows a plain placeholder, laid out like the app. */
export function phoneChromeFor(beat: Pick<Beat, "kind" | "staged">, placeholder = false): PhoneChrome {
  if (beat.kind === "staged" && beat.staged && !placeholder) return STAGED_CHROME[beat.staged];
  return APP_CHROME;
}
