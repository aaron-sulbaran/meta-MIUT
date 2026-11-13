"use client";

import { SourceBadge } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { MuseFace } from "@/components/map/muse-menu";
import { buttonClass } from "@/components/ui/button";
import { CompanyToggle } from "@/components/social/company-toggle";
import { ChevronRightIcon, CloseIcon, InstagramPostIcon, WaveIcon } from "@/components/ui/icons";
import { updateAttendance } from "@/lib/attendance/client";
import { EVENT_FULL_ERROR } from "@/lib/attendance/schema";
import { getViewerId } from "@/lib/attendance/viewer";
import { HANDOFF } from "@/lib/demo/staged";
import { SAVE_FAILED } from "@/lib/http";
import { friendsGoingLine, friendsNamesLine, sharedLine, type GoingPerson, type WhoIsGoing } from "@/lib/social/types";

// The event page's going button and Who's going section, in the measured
// Facebook look (hub kb/facebook-ui.md). One going button sits under the title
// like Facebook's action row: I'm going, or RSVP on RSVP events, then a grey
// You're going (lisa). RSVP events with a limit show the spots left, kept in
// the attendance store (t-vp0w). Open to company is a switch (CompanyToggle).
// Who's going leads with friends by name ("Aaron and Lisa are going"), which
// opens a sheet of friends going (trish); Ask Muse says who to go with (demo
// beat U3d); Looking for company is Muse's card at the end of it: new people
// open to company who share interests, never friends, each with Say hi.

type Response = { data: WhoIsGoing | null; error: string | null };
type Seats = { capacity: number; left: number };
type MusePick = { line: string; people: { id: string; why: string }[] };
type MuseResponse = { data: (MusePick & { who: WhoIsGoing }) | null; error: string | null; source?: "muse" | "fixture" };
// Say hi: Muse writes the hello, then it goes to everyone named (POST /api/social/hello with write).
type HelloResponse = Response & { hello?: { message: string; source: "muse" | "fixture"; ms: number | null } | null };
type Hi = { names: string[]; state: "writing" | "sent" | "error"; message?: string; source?: "muse" | "fixture"; ms?: number | null };
type SentHello = { data: { to: string[]; names: string[]; message: string | null; source: "muse" | "fixture" } | null };
// How long "Muse is writing" shows when a hi sent from another screen of the same person arrives.
const WRITING_BEAT_MS = 1400;
const SENT_POLL_MS = 1500;
// How often a page waiting on a yes checks for one.
const YES_POLL_MS = 1200;
const framed = () => typeof window !== "undefined" && window.self !== window.top;

/** "Lisa", "Lisa and Jolyn", "Lisa, Jolyn and Maya". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

async function post<T>(url: string, body: unknown): Promise<T | { data: null; error: string }> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { data: null, error: "Network error" };
  }
  // The server answered, so this is not the network: an error page that is not JSON reads plainly.
  return (await response.json().catch(() => ({ data: null, error: SAVE_FAILED }))) as T | { data: null; error: string };
}

// Soft tints for people's initials: no photos of people in the app.
const TINTS = [
  ["#e7f0ff", "#0b57d0"],
  ["#fdebec", "#b3261e"],
  ["#e6f4ea", "#137333"],
  ["#fef7e0", "#8a5a00"],
  ["#f3e8fd", "#7627bb"],
  ["#e0f7fa", "#00695c"],
] as const;

function tintFor(id: string) {
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[value % TINTS.length]!;
}

export function Avatar({ person, size = 34 }: { person: { id: string; name: string }; size?: number }) {
  const [fill, ink] = tintFor(person.id);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold ring-2 ring-card"
      style={{ width: size, height: size, background: fill, color: ink, fontSize: Math.round(size * 0.42) }}
    >
      {person.name.slice(0, 1)}
    </span>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function MuseBadge({ size }: { size: number }) {
  return (
    <span className="shrink-0 overflow-hidden rounded-full ring-1 ring-black/5" style={{ width: size, height: size }}>
      <MuseFace size={size} className="scale-[1.18]" />
    </span>
  );
}

export function WhosGoing({
  initial,
  rsvp = false,
  seats: initialSeats = null,
  autoAsk = false,
  autoSayHi = false,
  onJoin,
  onCompany,
  autoSayYes = false,
}: {
  initial: WhoIsGoing;
  rsvp?: boolean;
  /** Spots on an RSVP event with a limit; null when there is no limit. */
  seats?: Seats | null;
  /** Demo hook (?auto=1, beat U3d): ask Muse who to go with on arrival and bring the answer into view. */
  autoAsk?: boolean;
  /** Demo hook (?hi=1, beat U3e): say hi to everyone open to company once Muse has suggested them. */
  autoSayHi?: boolean;
  /** Joining through someone's invite (Lisa): marks this viewer and the inviter going instead of the plain going call. */
  onJoin?: () => Promise<boolean>;
  /** Told after Open to company is saved. */
  onCompany?: (open: boolean) => void;
  /** Demo hook (?yes=1, beat U3f): once the hi is sent, Jolyn and Lisa say yes (a laptop-only run). */
  autoSayYes?: boolean;
}) {
  const [who, setWho] = useState(initial);
  const [seats, setSeats] = useState(initialSeats);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [helloBusy, setHelloBusy] = useState<string | null>(null);
  const [helloError, setHelloError] = useState<string | null>(null);
  const [hi, setHi] = useState<Hi | null>(null);
  const hiRef = useRef<HTMLDivElement>(null);
  // Muse's hello comes into view as it is written and sent.
  useEffect(() => {
    if (!hi) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    hiRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  }, [hi]);
  const [muse, setMuse] = useState<{ state: "idle" | "asking" | "done"; pick: MusePick | null; error: string | null; recorded?: boolean }>({
    state: "idle",
    pick: null,
    error: null,
  });

  const goingUrl = `/api/social/events/${encodeURIComponent(who.eventId)}`;
  const full = seats !== null && seats.left === 0 && !who.viewer.going;

  // Coming back to a cached page still shows your latest Going and the latest list.
  useEffect(() => {
    let live = true;
    fetch(goingUrl, { cache: "no-store" })
      .then((response) => response.json() as Promise<Response>)
      .then((latest) => {
        if (live && latest?.data) setWho(latest.data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [goingUrl]);

  async function setGoing(going: boolean, open: boolean) {
    setBusy(true);
    setError(null);
    if (onJoin && going && !who.viewer.going) {
      const joined = await onJoin();
      const latest = joined ? await fetch(goingUrl, { cache: "no-store" }).then((response) => response.json() as Promise<Response>).catch(() => null) : null;
      setBusy(false);
      if (!joined) setError(SAVE_FAILED);
      if (latest?.data) setWho(latest.data);
      return;
    }
    // An RSVP holds a spot, so it goes through the attendance store first.
    if (rsvp && going !== who.viewer.going) {
      const attendance = await updateAttendance(who.eventId, getViewerId(), going ? "rsvp" : "cancel_rsvp");
      if (attendance.data && attendance.data.capacity !== null) {
        setSeats({ capacity: attendance.data.capacity, left: attendance.data.seatsLeft ?? 0 });
      }
      if (attendance.error !== null) {
        setBusy(false);
        setError(attendance.error === EVENT_FULL_ERROR ? "This event is full." : attendance.error);
        return;
      }
    }
    const result = await post<Response>(goingUrl, { going, open });
    setBusy(false);
    if (result.error) setError(result.error);
    if (result.data) setWho(result.data);
    if (result.data && going && open !== who.viewer.open) onCompany?.(open);
  }

  async function askMuse() {
    setMuse({ state: "asking", pick: null, error: null });
    const result = await post<MuseResponse>(`${goingUrl}/muse`, {});
    if (!result.data) {
      setMuse({ state: "idle", pick: null, error: result.error ?? "Muse could not check right now." });
      return;
    }
    setWho(result.data.who);
    // Everyone looking for company gets a row (and Say hi), Muse's picks first.
    const picked = new Set(result.data.people.map((person) => person.id));
    const rest = result.data.who.openToCompany
      .filter((person) => !picked.has(person.id))
      .map((person) => ({ id: person.id, why: sharedLine(person.shared) }));
    // A recorded answer (Muse unreachable) says so, like every other Muse screen.
    const recorded = "source" in result && result.source === "fixture";
    setMuse({ state: "done", pick: { line: result.data.line, people: [...result.data.people, ...rest] }, error: null, recorded });
  }

  const sectionRef = useRef<HTMLElement>(null);
  const autoAsked = useRef(false);
  useEffect(() => {
    if (!autoAsk || autoAsked.current) return;
    const timer = setTimeout(() => {
      autoAsked.current = true;
      void askMuse();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);
  useEffect(() => {
    if (!autoAsk || muse.state !== "done") return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest" });
  }, [autoAsk, muse.state]);

  // Muse writes the hi (a real call), shows it, and sends it to everyone named.
  async function sayHi(personIds: string[], tapped = true) {
    const names = personIds.map((id) => who.openToCompany.find((person) => person.id === id)?.name ?? "them");
    setHelloBusy(personIds[0] ?? null);
    setHelloError(null);
    setHi({ names, state: "writing" });
    const result = await post<HelloResponse>("/api/social/hello", { eventId: who.eventId, to: personIds, write: true });
    setHelloBusy(null);
    if (!result.data) {
      setHi(null);
      setHelloError(result.error ?? "Could not say hi right now.");
      return;
    }
    const written = "hello" in result ? result.hello : null;
    setHi({ names, state: "sent", message: written?.message, source: written?.source, ms: written?.ms });
    setWho(result.data);
    // On a presenter's phone, the stage moves to the next beat (U3e), where its own copy shows it too.
    if (tapped && framed() && autoAsk) window.parent.postMessage({ type: "demo-handoff", path: HANDOFF.saidHi(who.eventId) }, window.location.origin);
    // They answer a few seconds later; check back until they have.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const latest = await fetch(goingUrl).then((response) => response.json() as Promise<Response>).catch(() => null);
      if (!latest?.data) continue;
      setWho(latest.data);
      if (personIds.every((id) => latest.data!.openToCompany.find((person) => person.id === id)?.hello === "accepted")) return;
    }
  }

  // Every screen of the same person (the stage's copy of this page, the phone) shows a hi once it
  // exists on the server, with a short "Muse is writing" first so the room sees it happen.
  const hiNowRef = useRef<Hi | null>(null);
  useEffect(() => {
    hiNowRef.current = hi;
  }, [hi]);
  const showSent = async (): Promise<boolean> => {
    const sent = await fetch(`/api/social/hello?eventId=${encodeURIComponent(who.eventId)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<SentHello>)
      .catch(() => null);
    if (!sent?.data || hiNowRef.current) return Boolean(sent?.data);
    const found = sent.data;
    setHi({ names: found.names, state: "writing" });
    await new Promise((resolve) => setTimeout(resolve, WRITING_BEAT_MS));
    setHi({ names: found.names, state: "sent", message: found.message ?? undefined, source: found.source, ms: null });
    // Then follow them saying yes, as the phone that sent it does.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const latest = await fetch(goingUrl, { cache: "no-store" }).then((response) => response.json() as Promise<Response>).catch(() => null);
      if (latest?.data) setWho(latest.data);
      if (latest?.data && found.to.every((id) => latest.data!.openToCompany.find((person) => person.id === id)?.hello === "accepted")) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return true;
  };
  const showSentRef = useRef(showSent);
  const sayHiRef = useRef(sayHi);
  const askMuseRef = useRef(askMuse);
  useEffect(() => {
    showSentRef.current = showSent;
    sayHiRef.current = sayHi;
    askMuseRef.current = askMuse;
  });
  useEffect(() => {
    if (!framed()) return;
    const timer = setInterval(() => {
      if (!hiNowRef.current) void showSentRef.current();
    }, SENT_POLL_MS);
    return () => clearInterval(timer);
  }, []);
  // The stage's Next on the last beat (U3e, {type: "demo-say-hi"}) or a fresh ?hi=1: when no
  // phone has said hi yet, this page does it, the same real call.
  const [sayHiWanted, setSayHiWanted] = useState(autoSayHi);
  const sayHiStarted = useRef(false);
  useEffect(() => {
    if (!framed()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if ((event.data as { type?: unknown } | null)?.type === "demo-say-hi") setSayHiWanted(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (!sayHiWanted || hi || sayHiStarted.current) return;
    if (muse.state === "idle") {
      void askMuseRef.current();
      return;
    }
    if (muse.state !== "done") return;
    sayHiStarted.current = true;
    void showSentRef.current().then((already) => {
      const ids = who.openToCompany.filter((person) => !person.hello).map((person) => person.id);
      if (!already && !hiNowRef.current && ids.length > 0) void sayHiRef.current(ids, false);
    });
  }, [sayHiWanted, hi, muse.state, who.openToCompany]);

  // Someone said hi and is waiting on a yes: follow it, so a yes from Jolyn's or Lisa's phone shows in a second or two.
  const waitingOnYes = who.openToCompany.some((person) => person.hello === "pending");
  useEffect(() => {
    if (!waitingOnYes) return;
    const timer = setInterval(() => {
      void fetch(goingUrl, { cache: "no-store" })
        .then((response) => response.json() as Promise<Response>)
        .then((latest) => {
          if (latest.data) setWho(latest.data);
        })
        .catch(() => {});
    }, YES_POLL_MS);
    return () => clearInterval(timer);
  }, [waitingOnYes, goingUrl]);

  // The stage's Next after the hi (U3f, {type: "demo-say-yes"}) or a fresh ?yes=1: with no phones
  // in the room, Jolyn and Lisa say yes here, recorded the same way as their Say hi back.
  const [sayYesWanted, setSayYesWanted] = useState(autoSayYes);
  const sayYesSent = useRef(false);
  useEffect(() => {
    if (!framed()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if ((event.data as { type?: unknown } | null)?.type === "demo-say-yes") setSayYesWanted(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (!sayYesWanted || sayYesSent.current || hi?.state !== "sent") return;
    sayYesSent.current = true;
    void post<{ data: unknown; error: string | null }>("/api/social/hellos", { eventId: who.eventId, all: true }).then(() =>
      fetch(goingUrl, { cache: "no-store" })
        .then((response) => response.json() as Promise<Response>)
        .then((latest) => {
          if (latest.data) setWho(latest.data);
        })
        .catch(() => {}),
    );
  }, [sayYesWanted, hi, who.eventId, goingUrl]);
  const greeted = who.openToCompany.filter((person) => person.hello);
  const allSaidYes = greeted.length > 0 && greeted.every((person) => person.hello === "accepted");

  const namesLine = friendsNamesLine(who.friends);
  const companyCount = who.openToCompany.length;
  // Everyone going but the viewer's friends, the company list included (trish).
  const moreCount = who.othersCount + companyCount;

  return (
    <>
      <section aria-label="Your plans" className="px-3 pt-[12px]">
        <button
          type="button"
          aria-pressed={who.viewer.going}
          disabled={busy || full}
          onClick={() => void setGoing(!who.viewer.going, false)}
          className={buttonClass(who.viewer.going ? "secondary" : "primary", "w-full")}
        >
          {who.viewer.going && <CheckGlyph className="h-[17px] w-[17px]" />}
          {who.viewer.going ? "You're going" : full ? "Full" : rsvp ? "RSVP" : "I'm going"}
        </button>

        {seats !== null ? (
          <div className="mt-[8px]">
            <div className="flex items-center justify-between text-meta font-semibold">
              <span className={seats.left <= 5 ? "text-badge" : "text-muted"}>
                {seats.left === 0 ? "No spots left" : `${seats.left} ${seats.left === 1 ? "spot" : "spots"} left`}
              </span>
              <span className="text-muted">{seats.capacity} spots in all</span>
            </div>
            <div className="mt-[5px] h-[4px] overflow-hidden rounded-full bg-button" aria-hidden>
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.round(((seats.capacity - seats.left) / Math.max(1, seats.capacity)) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          rsvp && !who.viewer.going && <p className="mt-[6px] text-meta text-muted">RSVP required. Your RSVP saves your spot.</p>
        )}

        {who.viewer.going && <CompanyToggle on={who.viewer.open} disabled={busy} onChange={(open) => void setGoing(true, open)} />}
        {error && <p className="mt-[6px] text-meta font-semibold text-badge">{error}</p>}
      </section>

      <div aria-hidden className="my-[18px] h-px bg-hairline" />

      <section ref={sectionRef} aria-labelledby="whos-going-heading" className="scroll-mt-[64px] scroll-mb-[150px] px-3">
        <div className="flex items-baseline justify-between">
          <h2 id="whos-going-heading" className="font-display text-title font-bold">
            Who&apos;s going
          </h2>
          {who.goingCount > 0 && <span className="text-meta font-semibold text-muted">{who.goingCount} going</span>}
        </div>

        {namesLine ? (
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            aria-haspopup="dialog"
            className="mt-[10px] flex w-full items-center gap-[10px] text-left"
          >
            <span className="flex shrink-0 -space-x-[9px]">
              {who.friends.slice(0, 4).map((friend) => (
                <Avatar key={friend.id} person={friend} size={34} />
              ))}
            </span>
            <span className="min-w-0 flex-1 text-body font-semibold">{namesLine}</span>
            <ChevronRightIcon className="h-[16px] w-[16px] shrink-0 text-muted" />
          </button>
        ) : (
          <p className="mt-[8px] text-body text-muted">None of your friends yet. Be the first.</p>
        )}

        {moreCount > 0 && (
          <p className="mt-[8px] text-meta text-muted">
            {who.friends.length > 0 ? "Plus " : ""}
            {moreCount} {moreCount === 1 ? "student" : "students"} from campus
            {companyCount > 0 ? `, ${companyCount} looking for company` : ""}
          </p>
        )}

        <div className="mt-[12px] rounded-card border border-hairline">
          {muse.state === "done" && muse.pick ? (
            <div className="p-3">
              <div className="flex items-start gap-[10px]">
                <MuseBadge size={30} />
                <p className="min-w-0 flex-1 text-body font-medium" aria-live="polite">
                  {muse.pick.line}
                  {muse.recorded && (
                    <span className="mt-[2px] block">
                      <SourceBadge source="fixture" />
                    </span>
                  )}
                </p>
              </div>
              {muse.pick.people.length > 0 && (
                <ul className="mt-[10px] flex flex-col gap-[8px] pl-[40px]">
                  {muse.pick.people.map((pick) => {
                    const person = who.openToCompany.find((candidate) => candidate.id === pick.id);
                    if (!person) return null;
                    return (
                      <li key={pick.id} className="flex items-start gap-[10px]">
                        <Avatar person={person} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-label font-bold">{person.name}</span>
                          <span className="block truncate text-meta text-muted">{pick.why}</span>
                          {person.hello === "pending" && (
                            <span className="mt-[2px] block text-meta text-muted">Hi sent. Waiting for {person.name} to say yes.</span>
                          )}
                          {person.hello === "accepted" && person.instagram && (
                            <span className="mt-[4px] block text-meta font-semibold">
                              <span className="flex items-center gap-[5px]">
                                <InstagramPostIcon className="h-[15px] w-[15px] shrink-0" />
                                {person.name} said yes: @{person.instagram}
                              </span>
                              <span className="block font-normal text-muted">{person.name} can see your Instagram too.</span>
                            </span>
                          )}
                        </span>
                        {!person.hello && (
                          <button
                            type="button"
                            disabled={helloBusy !== null}
                            onClick={() => void sayHi([person.id])}
                            aria-label={`Say hi to ${person.name}`}
                            title="Say hi"
                            className={buttonClass("secondary", "h-[42px] w-[42px] shrink-0 rounded-full px-0")}
                          >
                            <WaveIcon className="h-[32px] w-[32px]" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {(() => {
                // One tap says hi to everyone Muse suggested who has not heard from you yet.
                const unsaid = muse.pick.people
                  .map((pick) => who.openToCompany.find((candidate) => candidate.id === pick.id))
                  .filter((person): person is GoingPerson => Boolean(person && !person.hello));
                if (hi || unsaid.length < 2) return null;
                return (
                  <button
                    type="button"
                    disabled={helloBusy !== null}
                    onClick={() => void sayHi(unsaid.map((person) => person.id))}
                    className={buttonClass("secondary", "mt-[10px] ml-[40px] w-[calc(100%-40px)] gap-[6px]")}
                  >
                    <WaveIcon className="h-[24px] w-[24px]" />
                    Say hi to {joinNames(unsaid.map((person) => person.name))}
                  </button>
                );
              })()}
              {hi && (
                <div ref={hiRef} className="mt-[12px] flex items-start gap-[10px]" aria-live="polite">
                  <MuseBadge size={30} />
                  <div className="min-w-0 flex-1">
                    {hi.state === "writing" ? (
                      <p className="font-display text-label font-bold">Muse is writing your hi to {joinNames(hi.names)}...</p>
                    ) : (
                      <>
                        {hi.message && (
                          <p className="rounded-[16px] rounded-tl-[6px] bg-wash px-[12px] py-[8px] text-body">{hi.message}</p>
                        )}
                        <p className="mt-[4px] flex items-center gap-[5px] text-meta font-semibold text-link">
                          <CheckGlyph className="h-[14px] w-[14px]" />
                          Sent to {joinNames(hi.names)}
                        </p>
                        {hi.source === "muse" ? (
                          <p className="text-meta text-muted">Written by Muse · Live{typeof hi.ms === "number" ? `, ${(hi.ms / 1000).toFixed(1)} s` : ""}</p>
                        ) : hi.source === "fixture" ? (
                          <SourceBadge source="fixture" />
                        ) : null}
                        {allSaidYes && (
                          <p className="mt-[8px] font-display text-label font-bold text-primary">
                            {joinNames(["You", ...greeted.map((person) => person.name)])} are going together.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {helloError && <p className="mt-[8px] pl-[40px] text-meta font-semibold text-badge">{helloError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void askMuse()}
              disabled={muse.state === "asking"}
              className="flex w-full items-center gap-[10px] p-3 text-left disabled:opacity-80"
            >
              <MuseBadge size={30} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-label font-bold">
                  {muse.state === "asking" ? "Muse is checking who's going..." : "Looking for company"}
                </span>
                <span className="block text-meta text-muted">{muse.error ?? "Muse suggests people who share your interests"}</span>
              </span>
              <ChevronRightIcon className="h-[16px] w-[16px] shrink-0 text-muted" />
            </button>
          )}
        </div>
      </section>

      {friendsOpen && <FriendsSheet friends={who.friends} close={() => setFriendsOpen(false)} />}
    </>
  );
}

// Friends going, as a sheet over the page (trish, PR #25).
function FriendsSheet({ friends, close }: { friends: GoingPerson[]; close: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-going-heading"
        onClick={(click) => click.stopPropagation()}
        className="max-h-[70%] w-full max-w-[390px] overflow-y-auto rounded-t-[18px] bg-card px-4 pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] pt-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="friends-going-heading" className="font-display text-title font-bold">
            {friendsGoingLine(friends)}
          </h2>
          <button type="button" onClick={close} aria-label="Close friends going" className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted">
            <CloseIcon className="h-[14px] w-[14px]" />
          </button>
        </div>
        <ul className="mt-[8px] flex flex-col divide-y divide-hairline">
          {friends.map((friend) => (
            <li key={friend.id} className="flex items-center gap-[10px] py-[10px]">
              <Avatar person={friend} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-label font-bold">{friend.name}</p>
                <p className="text-meta font-semibold text-muted">
                  {friend.year} · {friend.major}
                </p>
              </div>
              {friend.instagram && (
                <a
                  href={`https://instagram.com/${encodeURIComponent(friend.instagram)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-[5px] text-meta font-semibold text-link"
                >
                  <InstagramPostIcon className="h-[15px] w-[15px]" />@{friend.instagram}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
