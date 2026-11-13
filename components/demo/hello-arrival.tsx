"use client";

import { useEffect, useState } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { CAST, type CastId } from "@/lib/demo/beats";
import { STORY } from "@/lib/demo/story-data";

// The end of the pitch on Jolyn's and Lisa's phones: while Trish is on, their
// waiting screens check for a hi, and when Muse sends hers, it arrives here
// ("Trish said hi") with the line Muse wrote. All three end up connected.

// Who each waiting phone is in the going lists (lib/social/fixtures/people.ts).
const PERSON_OF_CAST: Partial<Record<CastId, string>> = { user1: "sample-student", user2: "lisa" };
const POLL_MS = 2000;

type Hello = { from: string; fromName: string; message: string | null; at: number };

export function HelloArrival({ cast, watching }: { cast: CastId; watching: boolean }) {
  const person = PERSON_OF_CAST[cast];
  const [hello, setHello] = useState<Hello | null>(null);

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
    const timer = setInterval(check, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [person, watching]);

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
      </span>
    </div>
  );
}
