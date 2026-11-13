// The flag that makes a Facebook page play the hop from Instagram on arrival
// (components/demo/app-switch.tsx). Client safe, so link builders such as
// lib/demo/staged.ts HANDOFF can add it.

export const APP_SWITCH_PARAM = "opened";
export type SwitchFrom = "instagram";

/** The path with the flag that makes its page play the switch on arrival. */
export function withAppSwitch(path: string, from: SwitchFrom = "instagram"): string {
  return `${path}${path.includes("?") ? "&" : "?"}${APP_SWITCH_PARAM}=${from}`;
}

/** The flag's value from a page's searchParams, or null for anything else. */
export function switchFrom(value: string | string[] | undefined | null): SwitchFrom | null {
  return value === "instagram" ? "instagram" : null;
}
