"use client";

import { useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ClockIcon, FoodIcon, MapPinIcon, PeopleIcon } from "@/components/ui/icons";

// The invite landing's three moments: the invite, a one-tap account from the
// Meta account they already use on Instagram, then the event with "<inviter>
// knows you're going". Account creation is a short staged beat; marking Going
// goes through the real social store for both of them (POST /api/invite/[id]/accept).

type Step = "invite" | "creating" | "joined";

const CREATING_MS = 1_400;

function Detail({ Icon, children }: { Icon: (props: { className?: string }) => ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-[10px] text-body">
      <Icon className="mt-[1px] h-[18px] w-[18px] shrink-0 text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
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
  poster: ReactNode;
}) {
  const [step, setStep] = useState<Step>("invite");
  const [error, setError] = useState<string | null>(null);
  const inviter = inviterName ?? "A friend";

  async function join() {
    setError(null);
    setStep("creating");
    const [response] = await Promise.all([
      fetch(`/api/invite/${encodeURIComponent(eventId)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: inviterId ?? undefined }),
      }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, CREATING_MS)),
    ]);
    if (!response?.ok) {
      setStep("invite");
      setError("Could not join right now. Try again.");
      return;
    }
    setStep("joined");
  }

  return (
    // Covers the app frame: someone with no account sees no Facebook tab bar.
    <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-[390px] flex-col overflow-y-auto bg-page">
      <header className="flex h-[52px] items-center px-[14px]">
        <span className="pb-[3px] font-display text-[29px] leading-[34px] font-extrabold tracking-[-0.05em] text-primary">facebook</span>
      </header>

      {step === "joined" ? (
        <p
          role="status"
          className="mx-[12px] mb-[10px] flex items-center gap-[10px] rounded-card bg-primary-soft px-[12px] py-[10px] font-display text-label font-bold text-link"
        >
          <span aria-hidden className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <svg viewBox="0 0 16 16" className="h-[12px] w-[12px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </span>
          {inviter} knows you&apos;re going!
        </p>
      ) : null}

      {poster}

      <section className="px-[14px] pt-[14px]">
        {step !== "joined" && (
          <div className="mb-[10px] flex items-center gap-[8px]">
            <span
              aria-hidden
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary font-display text-[14px] font-bold text-on-primary"
            >
              {inviter.charAt(0)}
            </span>
            <p className="font-display text-label font-bold">{inviter} invited you</p>
          </div>
        )}
        <p className="text-meta font-semibold text-muted">{dateLine}</p>
        <h1 className="mt-[3px] font-display text-[22px] leading-[26px] font-bold">{eventTitle}</h1>
        <p className="mt-[4px] text-venue font-semibold text-ink">
          {placeName} · Hosted by {organizerName}
        </p>
      </section>

      {step === "joined" ? (
        <section className="px-[14px] pt-[16px] pb-[24px]">
          <ul className="flex flex-col gap-[12px]">
            <Detail Icon={ClockIcon}>{timeLine}</Detail>
            <Detail Icon={MapPinIcon}>{placeName}</Detail>
            {perk && <Detail Icon={FoodIcon}>Free · {perk}</Detail>}
            <Detail Icon={PeopleIcon}>You and {inviter} are going</Detail>
          </ul>
          <ButtonLink href={`/events/${encodeURIComponent(eventId)}`} tone="primary" className="mt-[18px] w-full">
            Open the event
          </ButtonLink>
        </section>
      ) : (
        <section className="mx-[12px] mt-[16px] mb-[24px] rounded-card border border-hairline p-[14px]">
          <h2 className="font-display text-title font-bold">Join {inviter} on Facebook</h2>
          <p className="mt-[6px] text-body text-muted">
            You don&apos;t have a Facebook account yet. Use the Meta account you already have on Instagram.
          </p>
          <button
            type="button"
            onClick={join}
            disabled={step === "creating"}
            className="mt-[14px] flex h-[44px] w-full items-center justify-center gap-[8px] rounded-button bg-primary font-display text-label font-bold text-on-primary disabled:opacity-80"
          >
            {step === "creating" ? (
              <>
                <span aria-hidden className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-on-primary border-t-transparent motion-reduce:animate-none" />
                Creating your account
              </>
            ) : (
              `Continue as ${viewerName}`
            )}
          </button>
          {viewerInstagram && (
            <p className="mt-[8px] text-center text-venue text-muted">@{viewerInstagram} on Instagram · one Meta account</p>
          )}
          {error && (
            <p role="alert" className="mt-[8px] text-center text-venue text-ink">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
