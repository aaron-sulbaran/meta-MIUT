// The steps of Lisa's invite landing (components/invite/invite-landing.tsx), one
// per beat. A plain module, so the server page can read ?state= with it.

export type InviteStep = "locked" | "account" | "ready" | "event" | "joined";
export const INVITE_STEPS: readonly InviteStep[] = ["locked", "account", "ready", "event", "joined"];

/** The step a ?state= value names, or the locked preview for anything else. */
export function inviteStep(value: string | undefined): InviteStep {
  return INVITE_STEPS.find((step) => step === value) ?? "locked";
}
