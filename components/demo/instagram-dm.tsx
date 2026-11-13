"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DrawnAvatar, IG, IgIcons, StagedScreen } from "@/components/demo/instagram";
import { MuseMark } from "@/components/ui/icons";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { HANDOFF, handOff } from "@/lib/demo/staged";

// U2a: Lisa's Instagram thread with Aaron. The first two lines are the skit;
// the invite is real: it shows up when Aaron's Muse sends it from the map,
// in Muse's own words, with a card that opens the event on Facebook (U2b).

type Invite = { id: string; eventId: string; from: string; message: string; href: string | null; at: string };
type EventSummary = { title: string; start: string; place: { name: string }; free: boolean; organizer: { name: string } };

const POLL_MS = 2000;

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

export function InstagramDm({ to }: { to: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(`/api/social/invites?to=${encodeURIComponent(to)}`, { cache: "no-store" });
        const body = (await response.json()) as { data: { invites: Invite[] } | null };
        const newest = body.data?.invites.at(-1) ?? null;
        if (!stopped && newest) setInvite((current) => (current?.id === newest.id ? current : newest));
      } catch {
        // Try again on the next tick.
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [to]);

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(invite.eventId)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data: EventSummary | null }>)
      .then((body) => {
        if (!cancelled) setEvent(body.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invite]);

  // Who sent it, from the invite's own link (?invite=<viewer id>), for the landing.
  const inviter = invite?.href ? (new URL(invite.href, "http://local").searchParams.get("invite") ?? "sample-student") : "sample-student";

  return (
    <StagedScreen label="Staged Instagram message">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#efefef] px-3">
        <span aria-hidden>{IgIcons.back()}</span>
        <DrawnAvatar name="Aaron" size={32} />
        <div className="min-w-0 flex-1 leading-[17px]">
          <p className="text-[15px] font-semibold">Aaron</p>
          <p className="text-[12px]" style={{ color: IG.muted }}>
            Active now
          </p>
        </div>
        <span className="flex items-center gap-5" aria-hidden>
          {IgIcons.phone()}
          {IgIcons.video()}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[6px] overflow-y-auto px-3 py-3">
        <p className="mb-2 text-center text-[12px]" style={{ color: IG.muted }}>
          Today
        </p>
        <p className="max-w-[75%] self-end rounded-[20px] px-[14px] py-[9px] text-[15px] text-white" style={{ background: "linear-gradient(120deg,#5b51f5,#a43fe0)" }}>
          still on for later?
        </p>
        <div className="flex items-end gap-2">
          <DrawnAvatar name="Aaron" size={26} />
          <p className="max-w-[75%] rounded-[20px] px-[14px] py-[9px] text-[15px]" style={{ background: IG.bubble }}>
            yes, just got out of class. finding us something
          </p>
        </div>

        {!invite && (
          <p className="ml-[34px] mt-1 text-[12px]" style={{ color: IG.muted }} aria-live="polite">
            Aaron is typing...
          </p>
        )}
        {invite && (
          <div className="flex flex-col gap-[6px] motion-safe:animate-[staged-pop_260ms_ease-out]">
            <p className="ml-[34px] flex items-center gap-1 text-[11px]" style={{ color: IG.muted }}>
              <MuseMark className="h-[12px] w-[12px] text-[#0866ff]" />
              Sent by {invite.from}&apos;s Muse · {when(invite.at)}
            </p>
            <div className="flex items-end gap-2">
              <DrawnAvatar name="Aaron" size={26} />
              <div className="flex max-w-[78%] flex-col gap-[6px]">
                <p className="rounded-[20px] px-[14px] py-[9px] text-[15px] leading-[20px]" style={{ background: IG.bubble }}>
                  {invite.message}
                </p>
                <button
                  type="button"
                  onClick={() => handOff(HANDOFF.lisaLanding(invite.eventId, inviter), router.push)}
                  className="overflow-hidden rounded-[16px] border border-[#efefef] bg-white text-left"
                  aria-label={`Open the event${event ? `: ${event.title}` : ""}`}
                >
                  <div className="flex h-[96px] items-end bg-[#0866ff] p-3">
                    <p className="line-clamp-2 text-[17px] font-bold leading-[20px] text-white">{event?.title ?? "Facebook event"}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[13px] font-semibold">{event ? when(event.start) : "Event invite"}</p>
                    <p className="truncate text-[13px]" style={{ color: IG.muted }}>
                      {event ? `${event.place.name} · ${event.free ? "Free" : "Paid"}` : "Facebook Events"}
                    </p>
                    <p className="mt-1 text-[12px]" style={{ color: IG.muted }}>
                      facebook.com/events
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2" aria-hidden>
        <span className="flex flex-1 items-center gap-2 rounded-full bg-[#efefef] py-[6px] pl-[6px] pr-3">
          <span className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-white" style={{ background: IG.blue }}>
            {IgIcons.camera()}
          </span>
          <span className="flex-1 text-[15px]" style={{ color: IG.muted }}>
            Message...
          </span>
          {IgIcons.mic("h-[22px] w-[22px]")}
          {IgIcons.photo("h-[22px] w-[22px]")}
        </span>
      </div>
    </StagedScreen>
  );
}
