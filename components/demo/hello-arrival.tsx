"use client";

import { useEffect, useState } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { buttonClass } from "@/components/ui/button";
import { CAST, type CastId } from "@/lib/demo/beats";
import { STORY } from "@/lib/demo/story-data";

// The end of the pitch on Jolyn's and Lisa's phones: while Trish is on, their
// waiting screens check for a hi, and when Muse sends hers, it arrives here
// ("Trish said hi") with the line Muse wrote. Say hi back is their yes: Trish's
// event page (and the projector's copy) flips to "said yes", and all three are going together.

// Who each waiting phone is in the going lists (lib/social/fixtures/people.ts).
const PERSON_OF_CAST: Partial<Record<CastId, string>> = { user1: "sample-student", user2: "lisa" };

type Hello = { eventId: string; from: string; fromName: string; message: string | null; at: number; answered?: boolean };

// How often to check: the phone passes helloPollMs(beat) from lib/demo/beat-context.ts, fast only
// on Trish's last beats, so Say hi back shows within half a second of the hi being sent.
export function HelloArrival({ cast, watching, pollMs }: { cast: CastId; watching: boolean; pollMs: number }) {
  const person = PERSON_OF_CAST[cast];
  const [hello, setHello] = useState<Hello | null>(null);
  const [answer, setAnswer] = useState<"idle" | "sending" | "error">("idle");

  async function sayHiBack() {
    if (!hello || !person) return;
    setAnswer("sending");
    const response = await fetch("/api/social/hellos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: hello.eventId, from: hello.from, to: person }),
    }).catch(() => null);
    if (!response?.ok) {
      setAnswer("error");
      return;
    }
    setAnswer("idle");
    setHello({ ...hello, answered: true });
  }

  useEffect(() => {
    if (!person || !watching) return;
    let live = true;
    const check = () =>
      fetch(`/api/social/hellos?to=${encodeURIComponent(person)}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ data: Hello[] | null }>)
        .then((body) => {
          const fromTrish = body.data?.find((item) => item.from === "user3");
          if (live && fromTrish) setHello(fromTrish);
        })
        .catch(() => {});
    void check();
    const timer = setInterval(check, pollMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [person, watching, pollMs]);

  if (!hello) return null;
  return (
    <div
      role="status"
      className="flex w-full items-start gap-[12px] rounded-[18px] border border-hairline bg-card px-[14px] py-[12px] text-left shadow-[0_6px_24px_rgba(0,0,0,0.12)] motion-safe:animate-[hello-in_420ms_ease-out_both]"
    >
      <style>{"@keyframes hello-in{from{opacity:0;transform:translateY(-16px) scale(0.97)}to{opacity:1;transform:none}}"}</style>
      <CastAvatar id="user3" size={40} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-label font-bold">{CAST.user3.name} said hi</span>
        {hello.message && <span className="mt-[2px] block text-[14px] leading-[1.3] text-ink">{hello.message}</span>}
        <span className="mt-[4px] block text-meta text-muted">{STORY.title} · open to company</span>
        {hello.answered ? (
          <span className="mt-[8px] block font-display text-label font-bold text-primary">You said hi back. You&apos;re going together.</span>
        ) : (
          <button
            type="button"
            onClick={() => void sayHiBack()}
            disabled={answer === "sending"}
            className={buttonClass("primary", "mt-[8px]")}
          >
            {answer === "sending" ? "Saying hi..." : "Say hi back"}
          </button>
        )}
        {answer === "error" && <span className="mt-[4px] block text-meta font-semibold text-badge">Could not save that. Try again.</span>}
      </span>
    </div>
  );
}
