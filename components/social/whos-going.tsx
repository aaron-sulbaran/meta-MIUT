"use client";

import { SourceBadge } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { MuseFace } from "@/components/map/muse-menu";
import { buttonClass } from "@/components/ui/button";
import { ChevronRightIcon, CloseIcon, InstagramPostIcon, WaveIcon } from "@/components/ui/icons";
import { updateAttendance } from "@/lib/attendance/client";
import { EVENT_FULL_ERROR } from "@/lib/attendance/schema";
import { getViewerId } from "@/lib/attendance/viewer";
import { friendsGoingLine, friendsNamesLine, sharedLine, type GoingPerson, type WhoIsGoing } from "@/lib/social/types";

// The event page's going button and Who's going section, in the measured
// Facebook look (hub kb/facebook-ui.md). One going button sits under the title
// like Facebook's action row: I'm going, or RSVP on RSVP events, then a grey
// You're going (lisa). RSVP events with a limit show the spots left, kept in
// the attendance store (t-vp0w). Open to company is a checkbox only (lisa).
// Who's going leads with friends by name ("Aaron and Lisa are going"), which
// opens a sheet of friends going (trish); Ask Muse says who to go with (demo
// beat U3d); Looking for company is Muse's card at the end of it: new people
// open to company who share interests, never friends, each with Say hi.

type Response = { data: WhoIsGoing | null; error: string | null };
type Seats = { capacity: number; left: number };
type MusePick = { line: string; people: { id: string; why: string }[] };
type MuseResponse = { data: (MusePick & { who: WhoIsGoing }) | null; error: string | null; source?: "muse" | "fixture" };

async function post<T>(url: string, body: unknown): Promise<T | { data: null; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  } catch {
    return { data: null, error: "Network error" };
  }
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
}: {
  initial: WhoIsGoing;
  rsvp?: boolean;
  /** Spots on an RSVP event with a limit; null when there is no limit. */
  seats?: Seats | null;
  /** Demo hook (?auto=1, beat U3d): ask Muse who to go with on arrival and bring the answer into view. */
  autoAsk?: boolean;
}) {
  const [who, setWho] = useState(initial);
  const [seats, setSeats] = useState(initialSeats);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [helloBusy, setHelloBusy] = useState<string | null>(null);
  const [helloError, setHelloError] = useState<string | null>(null);
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

  async function sayHi(personId: string) {
    setHelloBusy(personId);
    setHelloError(null);
    const result = await post<Response>("/api/social/hello", { eventId: who.eventId, to: personId });
    setHelloBusy(null);
    if (!result.data) {
      setHelloError(result.error ?? "Could not say hi right now.");
      return;
    }
    setWho(result.data);
    // They answer a few seconds later; check back until they have.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const latest = await fetch(goingUrl).then((response) => response.json() as Promise<Response>).catch(() => null);
      if (!latest?.data) continue;
      setWho(latest.data);
      if (latest.data.openToCompany.find((person) => person.id === personId)?.hello === "accepted") return;
    }
  }

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

        {who.viewer.going && (
          <label className="mt-[10px] flex cursor-pointer items-start gap-[10px]">
            <input
              type="checkbox"
              checked={who.viewer.open}
              disabled={busy}
              onChange={(change) => void setGoing(true, change.target.checked)}
              className="mt-[2px] h-[18px] w-[18px] shrink-0 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-body font-semibold">Open to company</span>
              <span className="block text-meta text-muted">Students going can see your first name and the interests you share, and say hi.</span>
            </span>
          </label>
        )}
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
                            onClick={() => void sayHi(person.id)}
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
