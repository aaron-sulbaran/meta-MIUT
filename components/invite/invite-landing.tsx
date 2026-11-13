"use client";

import { useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ClockIcon, FoodIcon, MapPinIcon, PeopleIcon } from "@/components/ui/icons";
import { AccountRow, META_SYSTEM_FONT, MetaLockup, ProfileCircle } from "@/components/invite/meta-account";

// Where an invite lands for someone with no Facebook account (Lisa, beats U2b
// and U2c). Built from Meta's own screens (the hub's kb/meta-accounts-reference):
// 1. The invite, dimmed, under Meta's "Your Meta Account is here" sheet: her
//    Instagram account, one line, one blue pill.
// 2. The account is made: Meta's account card, where a Facebook circle joins
//    her Instagram one.
// 3. The event, "<inviter> knows you're going", and what came over from
//    Instagram, as Accounts Center rows.
// The account itself is staged (and says so); marking Going is real, for both
// of them (POST /api/invite/[id]/accept).

type Step = "invite" | "creating" | "leaving" | "joined";

// Long enough for the room to see the Facebook circle join, and to cover the real call.
const ACCOUNT_MOMENT_MS = 2_000;
const SHEET_EXIT_MS = 320;

const KEYFRAMES =
  "@keyframes ma-sheet-up{from{transform:translateY(100%)}to{transform:none}}" +
  "@keyframes ma-sheet-down{from{transform:none}to{transform:translateY(100%)}}" +
  "@keyframes ma-dim-in{from{opacity:0}to{opacity:1}}" +
  "@keyframes ma-dim-out{from{opacity:1}to{opacity:0}}" +
  "@keyframes ma-swap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
  "@keyframes ma-join{0%{opacity:0;transform:translateX(-14px) scale(.5)}70%{opacity:1;transform:translateX(0) scale(1.08)}100%{opacity:1;transform:none}}";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Detail({ Icon, children }: { Icon: (props: { className?: string }) => ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-[10px] text-body">
      <Icon className="mt-[1px] h-[18px] w-[18px] shrink-0 text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
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
}) {
  const [step, setStep] = useState<Step>("invite");
  const [error, setError] = useState<string | null>(null);
  const inviter = inviterName ?? "A friend";
  const handle = viewerInstagram ? `@${viewerInstagram}` : null;

  async function join() {
    setError(null);
    setStep("creating");
    const [response] = await Promise.all([
      fetch(`/api/invite/${encodeURIComponent(eventId)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: inviterId ?? undefined }),
      }).catch(() => null),
      wait(ACCOUNT_MOMENT_MS),
    ]);
    if (!response?.ok) {
      setStep("invite");
      setError("Could not join right now. Try again.");
      return;
    }
    setStep("leaving");
    await wait(SHEET_EXIT_MS);
    setStep("joined");
  }

  const joined = step === "joined";
  const sheetUp = step !== "joined";

  return (
    // Covers the app frame and its chrome (tab bar, banners, the nearby opt-in):
    // someone with no account sees none of it.
    <div className="fixed inset-0 z-[60] mx-auto flex w-full max-w-[390px] flex-col overflow-y-auto bg-page">
      <style>{KEYFRAMES}</style>
      <header className="flex h-[52px] shrink-0 items-center px-[14px]">
        <span className="pb-[3px] font-display text-[29px] leading-[34px] font-extrabold tracking-[-0.05em] text-primary">facebook</span>
      </header>

      {joined && (
        <p
          role="status"
          className="mx-[12px] mb-[10px] flex items-center gap-[10px] rounded-card bg-primary-soft px-[12px] py-[10px] font-display text-label font-bold text-link motion-safe:animate-[ma-swap_300ms_ease-out]"
        >
          <span aria-hidden className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <svg viewBox="0 0 16 16" className="h-[12px] w-[12px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </span>
          {inviter} knows you&apos;re going!
        </p>
      )}

      {poster}

      <section className="px-[14px] pt-[14px]">
        {!joined && (
          <div className="mb-[10px] flex items-center gap-[8px]">
            <ProfileCircle name={inviter} size={30} />
            <p className="font-display text-label font-bold">{inviter} invited you</p>
          </div>
        )}
        <p className="text-meta font-semibold text-muted">{dateLine}</p>
        <h1 className="mt-[3px] font-display text-[22px] leading-[26px] font-bold">{eventTitle}</h1>
        <p className="mt-[4px] text-venue font-semibold text-ink">
          {placeName} · Hosted by {organizerName}
        </p>
      </section>

      {joined && (
        <>
          <section className="px-[14px] pt-[16px]">
            <ul className="flex flex-col gap-[12px]">
              <Detail Icon={ClockIcon}>{timeLine}</Detail>
              <Detail Icon={MapPinIcon}>{placeName}</Detail>
              {perk && <Detail Icon={FoodIcon}>Free · {perk}</Detail>}
              <Detail Icon={PeopleIcon}>You and {inviter} are going</Detail>
            </ul>
          </section>

          {/* What came over, in Accounts Center's shape: white grouped rows on a pale wash. */}
          <section
            className="mt-[20px] px-[12px] py-[14px] motion-safe:animate-[ma-swap_380ms_ease-out_120ms_both]"
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
              <AccountRow
                icon={
                  <svg viewBox="0 0 24 24" aria-hidden className="h-[24px] w-[24px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12.5 20 4m-3 3 2 2m-4.5-.5 2 2" />
                  </svg>
                }
                label="Login"
                detail="Your Instagram login works here"
              />
            </ul>
          </section>

          <section className="px-[14px] pt-[18px] pb-[28px]">
            <ButtonLink href={`/events/${encodeURIComponent(eventId)}`} tone="primary" className="w-full">
              Open the event
            </ButtonLink>
          </section>
        </>
      )}

      {sheetUp && (
        <div className="fixed inset-y-0 left-1/2 z-50 w-full max-w-[390px] -translate-x-1/2" style={{ fontFamily: META_SYSTEM_FONT }}>
          <div
            aria-hidden
            className={`absolute inset-0 bg-black/45 ${step === "leaving" ? "motion-safe:animate-[ma-dim-out_320ms_ease-in_both] motion-reduce:opacity-0" : "motion-safe:animate-[ma-dim-in_300ms_ease-out]"}`}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={step === "invite" ? "Your Meta Account is here" : "Your Meta Account now includes Facebook"}
            className={`absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-[20px] pt-[44px] pb-[max(22px,env(safe-area-inset-bottom))] text-[#1c2b33] ${
              step === "leaving" ? "motion-safe:animate-[ma-sheet-down_320ms_ease-in_both] motion-reduce:opacity-0" : "motion-safe:animate-[ma-sheet-up_420ms_cubic-bezier(.2,.8,.2,1)_250ms_both]"
            }`}
          >
            <StagedNote />
            {step === "invite" ? (
              <div key="invite">
                <h2 className="mx-auto max-w-[290px] text-center font-display text-[31px] leading-[38px] font-light tracking-[-0.01em]">
                  Your Meta Account is here
                </h2>
                <div className="mx-[8px] mt-[26px] flex flex-col items-center rounded-[28px] bg-[#f2f2f2] px-[20px] pt-[20px] pb-[22px]">
                  <MetaLockup />
                  <ProfileCircle name={viewerName} size={76} badge="instagram" className="mt-[16px]" />
                  <p className="mt-[12px] text-[18px] leading-[23px] font-semibold">{viewerName}</p>
                  {handle && <p className="text-[15px] leading-[20px] text-[#65676b]">{handle} on Instagram</p>}
                </div>
                <p className="mx-auto mt-[22px] max-w-[320px] text-center text-[15px] leading-[21px] text-[#65676b]">
                  {inviter} invited you to {eventTitle}. Join Facebook with the account you already use on Instagram.
                </p>
                <button
                  type="button"
                  onClick={join}
                  className="mt-[18px] h-[50px] w-full rounded-full bg-[#0866ff] text-[17px] font-semibold text-white active:scale-[0.99]"
                >
                  Continue as {viewerName}
                </button>
                {error && (
                  <p role="alert" className="mt-[8px] text-center text-[14px] text-[#1c2b33]">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <div key="made" className="motion-safe:animate-[ma-swap_260ms_ease-out]">
                <h2 className="mx-auto max-w-[300px] text-center font-display text-[31px] leading-[38px] font-light tracking-[-0.01em]">
                  {viewerName}, you&apos;re on Facebook
                </h2>
                {/* Meta's own picture of an account: one card, a profile per app, each with its badge. */}
                <div className="mx-[8px] mt-[26px] rounded-[24px] bg-white px-[18px] pt-[16px] pb-[18px] shadow-[0_6px_28px_rgba(28,43,51,0.14)] ring-1 ring-[#eceef1]">
                  <div className="flex items-center gap-[10px]">
                    <MetaLockup />
                    <span className="min-w-0 truncate text-[14px] text-[#65676b]">{handle ?? viewerName}</span>
                  </div>
                  <div className="mt-[16px] flex items-center justify-center">
                    <ProfileCircle name={viewerName} size={64} badge="instagram" />
                    <ProfileCircle name={viewerName} size={64} badge="facebook" className="-ml-[10px] motion-safe:animate-[ma-join_520ms_cubic-bezier(.2,.8,.2,1)_420ms_both]" />
                  </div>
                  <p className="mt-[12px] text-center text-[14px] text-[#65676b]">Instagram and Facebook, one Meta Account</p>
                </div>
                <p className="mx-auto mt-[22px] max-w-[320px] text-center text-[15px] leading-[21px] text-[#65676b]">
                  Same login as Instagram. Nothing new to remember.
                </p>
                <div
                  role="status"
                  className="mt-[18px] flex h-[50px] w-full items-center justify-center gap-[10px] rounded-full bg-[#e7f0ff] text-[16px] font-semibold text-[#0866ff]"
                >
                  <span aria-hidden className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-[#0866ff] border-t-transparent motion-reduce:animate-none" />
                  Joining {eventTitle}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
