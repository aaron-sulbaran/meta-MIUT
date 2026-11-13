"use client";

import { HANDOFF, handOff } from "@/lib/demo/staged";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClockIcon, FoodIcon, MapPinIcon, PeopleIcon } from "@/components/ui/icons";
import type { InviteStep } from "@/components/invite/steps";
import { AccountRow, META_SYSTEM_FONT, MetaLockup, ProfileCircle } from "@/components/invite/meta-account";
import { SAVE_FAILED } from "@/lib/http";

// Where an invite lands for someone with no Facebook account (Lisa's act, beats
// U2b to U2f). Every step is her own tap, and each tells the /demo stage (or her
// presenter phone) so the show follows her:
// 1. locked:  the event page, title readable, "<inviter> invited you" on top, and
//             the time, place, who's going, and the flyer greyed out, with the reason:
//             she needs a Facebook account to see the rest. One button.
// 2. account: Meta's own "Your Meta Account is here" sheet (the hub's
//             kb/meta-accounts-reference), her Instagram account, one blue pill.
// 3. ready:   "Your Facebook account is ready", her Instagram name and photo carried over.
// 4. event:   the sheet lifts and the event unlocks, with an I'm going button (the event page's own words).
// 5. joined:  only now the accept call runs: "You're going", "<inviter> knows
//             you're going", and Open to company, which hands the show to the next person.
// The account is staged (and says so); Going and Open to company are real.


const SHEET_EXIT_MS = 320;

const KEYFRAMES =
  "@keyframes ma-sheet-up{from{transform:translateY(100%)}to{transform:none}}" +
  "@keyframes ma-sheet-down{from{transform:none}to{transform:translateY(100%)}}" +
  "@keyframes ma-dim-in{from{opacity:0}to{opacity:1}}" +
  "@keyframes ma-dim-out{from{opacity:1}to{opacity:0}}" +
  "@keyframes ma-swap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
  "@keyframes ma-pop{0%{opacity:0;transform:scale(.4)}70%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}" +
  "@keyframes ma-join{0%{opacity:0;transform:translateX(-14px) scale(.5)}70%{opacity:1;transform:translateX(0) scale(1.08)}100%{opacity:1;transform:none}}";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tell the /demo stage or a presenter phone (the parent frame), if there is one. */
function tellParent(message: object) {
  if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage(message, window.location.origin);
}

function Detail({ Icon, children }: { Icon: (props: { className?: string }) => ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-[10px] text-body">
      <Icon className="mt-[1px] h-[18px] w-[18px] shrink-0 text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** A detail she cannot see yet: its icon, and a grey bar where the words would be. */
function HiddenDetail({ Icon, width, label }: { Icon: (props: { className?: string }) => ReactNode; width: number; label: string }) {
  return (
    <li className="flex items-center gap-[10px]" aria-label={`${label} hidden`}>
      <Icon className="h-[18px] w-[18px] shrink-0 text-[#bcc0c4]" />
      <span aria-hidden className="h-[12px] rounded-full bg-[#e4e6eb]" style={{ width }} />
    </li>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function StagedNote() {
  return (
    <span className="pointer-events-none absolute top-[14px] right-[14px] rounded-[6px] border border-dashed border-[#c7c7c7] px-[6px] py-[1px] text-[10px] font-medium text-[#8e8e8e]">
      Staged for the demo
    </span>
  );
}

export function InviteLanding({
  eventId,
  eventTitle,
  organizerName,
  dateLine,
  timeLine,
  placeName,
  perk,
  inviterId,
  inviterName,
  viewerName,
  viewerInstagram,
  friendNames,
  poster,
  initialStep = "locked",
}: {
  eventId: string;
  eventTitle: string;
  organizerName: string;
  dateLine: string;
  timeLine: string;
  placeName: string;
  perk: string | null;
  inviterId: string | null;
  inviterName: string | null;
  viewerName: string;
  viewerInstagram: string | null;
  /** Her friends already on Facebook, the inviter first. */
  friendNames: string[];
  poster: ReactNode;
  /** The step to open on (?state=, one per beat); joined runs the accept on arrival, so it is true. */
  initialStep?: InviteStep;
}) {
  const [step, setStep] = useState<InviteStep>(initialStep);
  const [sheetLeaving, setSheetLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(false);
  const inviter = inviterName ?? "A friend";
  const handle = viewerInstagram ? `@${viewerInstagram}` : null;

  async function accept(): Promise<boolean> {
    const response = await fetch(`/api/invite/${encodeURIComponent(eventId)}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: inviterId ?? undefined }),
    }).catch(() => null);
    return response?.ok ?? false;
  }

  // Opened straight on the joined step (the stage jumped here): make it true.
  const acceptedOnArrival = useRef(false);
  useEffect(() => {
    if (initialStep !== "joined" || acceptedOnArrival.current) return;
    acceptedOnArrival.current = true;
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  /**
   * Her tap: tell the stage where she is now (it is the next beat's path, so the phone stays), then show it.
   * `tell` is false when the stage itself moved on and asked for the step ({type: "demo-step"}).
   */
  function advance(next: Exclude<InviteStep, "locked" | "joined">, tell = true) {
    setError(null);
    if (tell && inviterId) handOff(HANDOFF.lisaStep(eventId, inviterId, next), () => {});
    setStep(next);
  }

  async function seeEvent(tell = true) {
    setSheetLeaving(true);
    await wait(SHEET_EXIT_MS);
    setSheetLeaving(false);
    advance("event", tell);
  }

  // The stage (or her phone's wrapper) moved to the next beat with a key or Next:
  // it asks for the step in place instead of loading the page again.
  const moveRef = useRef<(step: InviteStep) => void>(() => {});
  useEffect(() => {
    moveRef.current = (next: InviteStep) => {
      if (next === step) return;
      if (next === "joined") void join(false);
      else if (next === "event") void seeEvent(false);
      else if (next !== "locked") advance(next, false);
    };
  });
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { type?: unknown; step?: unknown } | null;
      if (data?.type === "demo-step" && typeof data.step === "string") moveRef.current(data.step as InviteStep);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function join(tell = true) {
    setBusy(true);
    setError(null);
    const ok = await accept();
    setBusy(false);
    if (!ok) {
      setError(SAVE_FAILED);
      return;
    }
    if (tell && inviterId) handOff(HANDOFF.lisaJoined(eventId, inviterId), () => {});
    setStep("joined");
  }

  async function openToCompany() {
    if (company || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/social/events/${encodeURIComponent(eventId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ going: true, open: true }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(SAVE_FAILED);
      return;
    }
    setCompany(true);
    // Her act is done: the stage moves on to the next person.
    tellParent({ source: "demo-screen", type: "pass" });
  }

  const unlocked = step === "event" || step === "joined";
  const joined = step === "joined";
  const sheetUp = step === "account" || step === "ready";

  return (
    // Covers the app frame and its chrome (tab bar, banners, the nearby opt-in):
    // someone with no account sees none of it.
    <div className="fixed inset-0 z-[60] mx-auto w-full max-w-[390px] overflow-y-auto bg-page">
      <style>{KEYFRAMES}</style>
      <header className="flex h-[52px] shrink-0 items-center px-[14px]">
        <span className="pb-[3px] font-display text-[29px] leading-[34px] font-extrabold tracking-[-0.05em] text-primary">facebook</span>
      </header>

      {joined ? (
        <div role="status" className="mx-[12px] mb-[10px] overflow-hidden rounded-card bg-primary-soft motion-safe:animate-[ma-swap_300ms_ease-out]">
          <p className="flex items-center gap-[10px] px-[12px] pt-[10px] font-display text-[17px] font-bold text-link">
            <span aria-hidden className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary motion-safe:animate-[ma-pop_420ms_ease-out_both]">
              <Check className="h-[13px] w-[13px]" />
            </span>
            You&apos;re going
          </p>
          <p className="flex items-center gap-[8px] px-[12px] pt-[6px] pb-[10px] pl-[46px] text-body text-ink motion-safe:animate-[ma-swap_300ms_ease-out_380ms_both]">
            <ProfileCircle name={inviter} size={20} />
            {inviter} knows you&apos;re going
          </p>
        </div>
      ) : (
        <div className="mx-[12px] mb-[10px] flex items-center gap-[10px] rounded-card bg-wash px-[12px] py-[10px]">
          <ProfileCircle name={inviter} size={34} badge="instagram" />
          <p className="min-w-0 text-body leading-[19px]">
            <span className="block font-display text-label font-bold">{inviter} invited you</span>
            <span className="block text-meta text-muted">From your Instagram messages</span>
          </p>
        </div>
      )}

      {/* The flyer prints the time and place, so it stays blurred until she can see them. */}
      <div className="relative overflow-hidden">
        <div className={`transition-[filter,transform] duration-700 ease-out ${unlocked ? "" : "scale-[1.08] blur-[14px] saturate-50"}`}>{poster}</div>
        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
              <LockIcon className="h-[20px] w-[20px]" />
            </span>
          </span>
        )}
      </div>

      <section className="px-[14px] pt-[14px]">
        {unlocked ? (
          <p className="text-meta font-semibold text-muted">{dateLine}</p>
        ) : (
          <span aria-label="Date hidden" className="block h-[11px] w-[120px] rounded-full bg-[#e4e6eb]" />
        )}
        <h1 className="mt-[5px] font-display text-[22px] leading-[26px] font-bold">{eventTitle}</h1>
        <p className="mt-[4px] text-venue font-semibold text-ink">Hosted by {organizerName}</p>
      </section>

      {unlocked ? (
        <section className="px-[14px] pt-[16px] motion-safe:animate-[ma-swap_380ms_ease-out]">
          <ul className="flex flex-col gap-[12px]">
            <Detail Icon={ClockIcon}>{timeLine}</Detail>
            <Detail Icon={MapPinIcon}>{placeName}</Detail>
            {perk && <Detail Icon={FoodIcon}>Free · {perk}</Detail>}
            <Detail Icon={PeopleIcon}>{joined ? `You and ${inviter} are going` : `${inviter} is going`}</Detail>
          </ul>
        </section>
      ) : (
        <section className="px-[14px] pt-[16px]">
          <ul className="flex flex-col gap-[14px]">
            <HiddenDetail Icon={ClockIcon} width={150} label="Time" />
            <HiddenDetail Icon={MapPinIcon} width={190} label="Place" />
            <HiddenDetail Icon={PeopleIcon} width={130} label="Who's going" />
          </ul>
          <div className="mt-[16px] rounded-card border border-hairline px-[14px] py-[14px]">
            <p className="flex items-center gap-[8px] font-display text-label font-bold">
              <LockIcon className="h-[16px] w-[16px] text-muted" />
              The rest is on Facebook
            </p>
            <p className="mt-[4px] text-body leading-[19px] text-muted">
              To see the time, the place, and who&apos;s going, and to join {inviter}, you need a Facebook account.
            </p>
            <button
              type="button"
              onClick={() => advance("account")}
              className="mt-[12px] h-[42px] w-full rounded-[8px] bg-primary font-display text-label font-bold text-on-primary active:scale-[0.99]"
            >
              Create Facebook account
            </button>
          </div>
        </section>
      )}

      {step === "event" && (
        <section className="px-[14px] pt-[18px] pb-[24px]">
          <button
            type="button"
            onClick={() => void join()}
            disabled={busy}
            className="flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-primary font-display text-label font-bold text-on-primary active:scale-[0.99] disabled:opacity-70"
          >
            I&apos;m going
          </button>
          <p className="mt-[8px] text-center text-meta text-muted">{inviter} will know you&apos;re going.</p>
        </section>
      )}

      {joined && (
        <>
          <section className="mx-[12px] mt-[18px] rounded-card border border-hairline px-[14px] py-[12px]">
            <button
              type="button"
              role="switch"
              aria-checked={company}
              onClick={openToCompany}
              disabled={busy}
              className="flex w-full items-center gap-[12px] text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-label font-bold">Open to company</span>
                <span className="block text-meta leading-[16px] text-muted">
                  {company ? "On. Students going can see your first name and the interests you share, and say hi." : "Let other students going say hi. They see your first name and the interests you share."}
                </span>
              </span>
              <span aria-hidden className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 ${company ? "bg-primary" : "bg-[#d8dadf]"}`}>
                <span className={`absolute top-[3px] left-[3px] h-[24px] w-[24px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ${company ? "translate-x-[20px]" : ""}`} />
              </span>
            </button>
          </section>

          {/* What came over, in Accounts Center's shape: white grouped rows on a pale wash. */}
          <section
            className="mt-[18px] px-[12px] py-[14px] motion-safe:animate-[ma-swap_380ms_ease-out_120ms_both]"
            style={{ background: "linear-gradient(135deg, #fdf2f6 0%, #eef3ff 100%)", fontFamily: META_SYSTEM_FONT }}
          >
            <div className="flex items-center justify-between px-[4px] pb-[10px]">
              <p className="text-[15px] font-semibold text-[#1c2b33]">Came with you from Instagram</p>
              <MetaLockup height={13} />
            </div>
            <ul className="overflow-hidden rounded-[16px] bg-white">
              <AccountRow
                icon={
                  <span className="relative inline-flex">
                    <ProfileCircle name={viewerName} size={30} badge="instagram" />
                    <ProfileCircle name={viewerName} size={30} badge="facebook" className="-ml-[12px]" />
                  </span>
                }
                label="Profile"
                detail={handle ? `Your name and photo from ${handle}` : "Your name and photo from Instagram"}
              />
              {friendNames.length > 0 && <AccountRow icon={<PeopleIcon className="h-[24px] w-[24px]" />} label="Friends" detail={`${namesLine(friendNames)} are already here`} />}
            </ul>
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="px-[14px] pt-[8px] pb-[16px] text-center text-meta font-semibold text-badge">
          {error}
        </p>
      )}

      {sheetUp && (
        <div className="fixed inset-y-0 left-1/2 z-50 w-full max-w-[390px] -translate-x-1/2" style={{ fontFamily: META_SYSTEM_FONT }}>
          <div
            aria-hidden
            className={`absolute inset-0 bg-black/45 ${sheetLeaving ? "motion-safe:animate-[ma-dim-out_320ms_ease-in_both] motion-reduce:opacity-0" : "motion-safe:animate-[ma-dim-in_300ms_ease-out]"}`}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={step === "account" ? "Your Meta Account is here" : "Your Facebook account is ready"}
            className={`absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-[20px] pt-[44px] pb-[max(22px,env(safe-area-inset-bottom))] text-[#1c2b33] ${
              sheetLeaving ? "motion-safe:animate-[ma-sheet-down_320ms_ease-in_both] motion-reduce:opacity-0" : "motion-safe:animate-[ma-sheet-up_420ms_cubic-bezier(.2,.8,.2,1)_both]"
            }`}
          >
            <StagedNote />
            {step === "account" ? (
              <div key="account">
                {/* Two balanced lines, as on Meta's sheet: "Your Meta Account" over "is here". */}
                <h2 className="mx-auto text-center font-display text-[31px] leading-[38px] font-light tracking-[-0.01em] text-balance">
                  Your Meta Account
                  <br />
                  is here
                </h2>
                {/* Meta's account card: one profile per app, each with its badge. */}
                <div className="mx-[23px] mt-[26px] flex flex-col items-center rounded-[26px] bg-[#f5f5f5] px-[20px] pt-[18px] pb-[22px]">
                  <MetaLockup />
                  <div className="mt-[16px] flex items-center justify-center">
                    <ProfileCircle name={viewerName} size={68} badge="instagram" />
                    <ProfileCircle name={viewerName} size={68} badge="facebook" className="-ml-[10px]" />
                  </div>
                  <p className="mt-[12px] text-[18px] leading-[23px] font-semibold">{viewerName}</p>
                  {handle && <p className="text-[15px] leading-[20px] text-[#65676b]">{handle} on Instagram</p>}
                </div>
                <p className="mx-auto mt-[22px] max-w-[320px] text-center text-[15px] leading-[21px] text-[#65676b]">
                  Use the account you already have on Instagram to make your Facebook account. No new password.
                </p>
                <button
                  type="button"
                  onClick={() => advance("ready")}
                  className="mt-[18px] h-[46px] w-full rounded-full bg-[#2a61d9] text-[17px] font-medium text-white active:scale-[0.99]"
                >
                  Continue as {viewerName}
                </button>
              </div>
            ) : (
              <div key="ready" className="motion-safe:animate-[ma-swap_260ms_ease-out]">
                <div className="flex justify-center">
                  <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#2a61d9] text-white motion-safe:animate-[ma-pop_460ms_ease-out_both]">
                    <Check className="h-[20px] w-[20px]" />
                  </span>
                </div>
                <h2 className="mx-auto mt-[12px] max-w-[300px] text-center font-display text-[29px] leading-[35px] font-light tracking-[-0.01em] text-balance">
                  Your Facebook account is ready
                </h2>
                {/* Meta's own picture of an account: one card, a profile per app; Facebook's joins her Instagram one. */}
                <div className="mx-[8px] mt-[22px] rounded-[24px] bg-white px-[18px] pt-[16px] pb-[18px] shadow-[0_6px_28px_rgba(28,43,51,0.14)] ring-1 ring-[#eceef1]">
                  <div className="flex items-center gap-[10px]">
                    <MetaLockup />
                    <span className="min-w-0 truncate text-[14px] text-[#65676b]">{handle ?? viewerName}</span>
                  </div>
                  <div className="mt-[16px] flex items-center justify-center">
                    <ProfileCircle name={viewerName} size={64} badge="instagram" />
                    <ProfileCircle name={viewerName} size={64} badge="facebook" className="-ml-[10px] motion-safe:animate-[ma-join_520ms_cubic-bezier(.2,.8,.2,1)_300ms_both]" />
                  </div>
                  <p className="mt-[10px] text-center text-[18px] leading-[23px] font-semibold">{viewerName}</p>
                  <p className="text-center text-[14px] text-[#65676b]">Name and photo from Instagram</p>
                </div>
                <button
                  type="button"
                  onClick={() => void seeEvent()}
                  disabled={sheetLeaving}
                  className="mt-[22px] h-[46px] w-full rounded-full bg-[#2a61d9] text-[17px] font-medium text-white active:scale-[0.99]"
                >
                  See the event
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
