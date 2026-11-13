"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import { walkMinutes } from "@/lib/geo";
import { friendLabel, friendNamedIn } from "@/lib/map/friend-spots";
import {
  arrivesTooLate,
  googleDirectionsUrl,
  insertStop,
  removeStop,
  retime,
  type Point,
  type Route,
  type RouteStop,
  type TravelMode,
} from "@/lib/map/crawl-route";

// The food crawl on the map, laid out like a Google Maps trip: pick where the
// walk ends, Muse plans free stops on the way (POST /api/muse/crawl, Trish's
// planner), then a stop list with walking times, travel mode tabs, remove and
// add stop, directions in Google Maps, and an invite to send a friend.

export type CrawlEvent = {
  eventId: string;
  title: string;
  place: Point & { name: string };
  startIso: string;
  endIso: string;
};

type Ending = {
  kind: "home" | "friend" | "wander";
  label: string;
  to: Point;
  note?: string;
  friendName?: string;
  /** The friend's viewer id, so the invite can reach their phone in the app. */
  friendId?: string;
  /** Send Muse's invite to the friend as soon as the walk is planned ("and send her the invite"). */
  sendInvite?: boolean;
};

/**
 * A walk to plan as soon as the sheet opens: home (the alert's "on your way
 * home" link, /?plan=home), or toward a friend (Ask Muse on the map: "I'm
 * meeting Lisa instead").
 */
export type CrawlStart =
  | { kind: "home"; note?: string }
  | { kind: "friend"; to: Point; label: string; note: string; friendName: string | null; friendId?: string | null; sendInvite?: boolean };

// startMs: when the walk starts (leave now, or the time the student picked).
type Plan = { route: Route; pitch: string; invite: { eventId: string | null; message: string; path: string | null }; startMs: number };

type ApiStop = {
  eventId: string | null;
  title: string;
  kind: string;
  placeName: string;
  lat: number;
  lng: number;
  arriveAt: string;
  walkMinutes: number;
  mode: TravelMode;
};
type ApiPlan = {
  stops: ApiStop[];
  destination: Route["destination"];
  totalWalkMinutes: number;
  pitch: string;
  invite: { eventId: string | null; message: string; path: string | null };
};

// Home for the demo student until the profile carries a dorm (asked on the hub).
const HOME = { name: "Maseeh Hall", lat: 42.3575, lng: -71.0934 };

function endingFor(start: CrawlStart): Ending {
  if (start.kind === "home") return { kind: "home", label: HOME.name, to: HOME, note: start.note };
  return {
    kind: "friend",
    label: start.label,
    to: start.to,
    note: start.note,
    friendName: start.friendName ?? undefined,
    friendId: start.friendId ?? undefined,
    sendInvite: start.sendInvite,
  };
}

/** The Meet a friend line: a friend the map knows (lib/map/friend-spots.ts) ends the walk where they are. */
function friendEnding(note: string): Ending {
  const friend = friendNamedIn(note);
  return friend
    ? { kind: "friend", label: friendLabel(friend), to: friend, note, friendName: friend.name, friendId: friend.id }
    : { kind: "friend", label: "Your friend", to: HOME, note };
}

const KIND_LABELS: Record<string, string> = {
  main: "Main",
  dessert: "Dessert",
  drinks: "Drinks",
  snack: "Snack",
  merch: "Merch",
  event: "Event",
  plan: "Your stop",
  added: "Added",
};

const MODES: { id: TravelMode; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "transit", label: "Transit" },
  { id: "drive", label: "Drive" },
];


// Small line glyphs for the sheet (no emoji in UI strings).
function Glyph({ path, className = "h-[17px] w-[17px]" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={path} />
    </svg>
  );
}
const HOME_PATH = "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10";
const FRIEND_PATH = "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 8h5M19.5 5.5v5";
const PERSON_PATH = "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0";
const LOOP_PATH = "M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5";

// Times in campus time, like every other time in the app.
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

function toRoute(from: Point, plan: ApiPlan, eventsById: Map<string, CrawlEvent>): Route {
  const stops: RouteStop[] = plan.stops.map((stop) => {
    const event = stop.eventId ? eventsById.get(stop.eventId) : undefined;
    return { ...stop, startsAt: event?.startIso ?? null, endsAt: event?.endIso ?? null };
  });
  return { from, stops, destination: plan.destination, totalWalkMinutes: plan.totalWalkMinutes };
}

export function CrawlPlanner({
  studentSpot,
  events,
  dismissed,
  start,
  at,
  fromLabel,
  onRoute,
  onClose,
}: {
  studentSpot: Point;
  events: CrawlEvent[];
  dismissed: string[];
  /** Plan this walk right away instead of asking where the walk ends. */
  start?: CrawlStart;
  /** When walks start (ISO) unless the student picks a time: a set campus time for the demo (?time=). Now when left out. */
  at?: string | null;
  /** How the walk's start reads, like "Out of Data Structures"; "Your spot" when left out. */
  fromLabel?: string | null;
  onRoute: (route: Route | null) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"choose" | "loading" | "plan" | "error">(start ? "loading" : "choose");
  const [friendNote, setFriendNote] = useState("");
  const [ending, setEnding] = useState<Ending | null>(null);
  const [mode, setMode] = useState<TravelMode>("walk");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [adding, setAdding] = useState(false);
  const [shared, setShared] = useState(false);
  // Muse's invite to the friend, sent in the app (it reaches their phone as an alert).
  const [invited, setInvited] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const deliverInvite = useCallback(async (friendId: string, eventId: string, message: string) => {
    setInvited("sending");
    try {
      const response = await fetch("/api/social/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: friendId, eventId, message }),
      });
      setInvited(response.ok ? "sent" : "error");
    } catch {
      setInvited("error");
    }
  }, []);
  // Leave now, or depart at a picked time (a datetime-local value), like Google Maps.
  const [leaveAt, setLeaveAt] = useState("");
  // A set start time from the link (?time=), used while the student has not picked one.
  const presetStartMs = at ? Date.parse(at) : Number.NaN;
  const eventsById = useMemo(() => new Map(events.map((event) => [event.eventId, event])), [events]);

  const showPlan = useCallback(
    (next: Plan | null) => {
      setPlan(next);
      onRoute(next?.route ?? null);
    },
    [onRoute],
  );

  const request = useCallback(
    async (target: Ending, travel: TravelMode) => {
      setStep("loading");
      setAdding(false);
      const startMs = leaveAt ? new Date(leaveAt).getTime() : Number.isFinite(presetStartMs) ? presetStartMs : Date.now();
      try {
        const response = await fetch("/api/muse/crawl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            from: studentSpot,
            to: target.to,
            toLabel: target.label,
            note: target.note,
            mode: travel,
            at: new Date(startMs).toISOString(),
            // Events the student hid with Not for me never become stops.
            exclude: dismissed,
          }),
        });
        const body = (await response.json()) as { data: ApiPlan | null; error: string | null };
        if (!response.ok || !body.data) throw new Error(body.error ?? "No plan");
        const data = body.data;
        // Belt and braces until the planner reads `exclude`: drop hidden stops here too.
        const kept = { ...data, stops: data.stops.filter((stop) => !stop.eventId || !dismissed.includes(stop.eventId)) };
        let route = toRoute(studentSpot, kept, eventsById);
        if (kept.stops.length !== data.stops.length) route = retime(route, startMs);
        showPlan({ route, pitch: data.pitch, invite: data.invite, startMs });
        setStep("plan");
        if (target.sendInvite && target.friendId && data.invite.eventId) {
          void deliverInvite(target.friendId, data.invite.eventId, data.invite.message);
        }
      } catch {
        showPlan(null);
        setStep("error");
      }
    },
    [deliverInvite, dismissed, eventsById, leaveAt, presetStartMs, showPlan, studentSpot],
  );

  const choose = (target: Ending) => {
    setEnding(target);
    void request(target, mode);
  };

  // Opened with a walk to plan (the alert link, or Ask Muse on the map): plan it once.
  const started = useRef(false);
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    const target = endingFor(start);
    setEnding(target);
    void request(target, "walk");
    // The sheet is keyed per start; later changes to request do not re-plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const changeMode = (next: TravelMode) => {
    setMode(next);
    if (ending) void request(ending, next);
  };

  const edit = (route: Route) => {
    if (!plan) return;
    showPlan({ ...plan, route });
  };

  const close = () => {
    showPlan(null);
    onClose();
  };

  // Events to add: on before the walk would end, not hidden, not already a stop, nearest the route first.
  const addable = useMemo(() => {
    if (!plan) return [];
    const inRoute = new Set(plan.route.stops.map((stop) => stop.eventId));
    const points: Point[] = [plan.route.from, ...plan.route.stops, plan.route.destination];
    const now = plan.startMs;
    return events
      .filter((event) => !inRoute.has(event.eventId) && !dismissed.includes(event.eventId))
      .filter((event) => Date.parse(event.endIso) > now + 20 * 60_000 && Date.parse(event.startIso) < now + 4 * 60 * 60_000)
      .map((event) => ({ event, near: Math.min(...points.map((point) => walkMinutes(point, event.place))) }))
      .sort((a, b) => a.near - b.near)
      .slice(0, 5);
  }, [dismissed, events, plan]);

  const share = async () => {
    if (!plan) return;
    const url = plan.invite.path ? new URL(plan.invite.path, window.location.origin).toString() : undefined;
    try {
      if (navigator.share) await navigator.share({ text: plan.invite.message, url });
      else await navigator.clipboard.writeText(url ? `${plan.invite.message} ${url}` : plan.invite.message);
      setShared(true);
    } catch {
      // The student closed the share sheet.
    }
  };

  const sheet = "absolute inset-x-0 bottom-0 z-20 rounded-t-[18px] bg-card shadow-[0_-6px_20px_rgba(0,0,0,0.12)]";

  if (step === "choose") {
    return (
      <div className={`${sheet} px-4 pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+16px)] pt-3`} role="dialog" aria-label="Plan a food crawl">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-divider" />
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-title font-bold">Where does your walk end?</h2>
            <p className="mt-[2px] text-meta text-muted">Muse picks free stops on the way from events you have not hidden.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close food crawl" className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted">
            <CloseIcon className="h-[14px] w-[14px]" />
          </button>
        </div>
        <div className="mt-3 flex flex-col divide-y divide-hairline">
          <button type="button" onClick={() => choose({ kind: "home", label: HOME.name, to: HOME })} className="flex items-center gap-3 py-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wash" aria-hidden>
              <Glyph path={HOME_PATH} />
            </span>
            <span>
              <span className="block text-label font-semibold">Home</span>
              <span className="block text-meta text-muted">{HOME.name}</span>
            </span>
          </button>
          <form
            className="flex items-center gap-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!friendNote.trim()) return;
              choose(friendEnding(friendNote.trim()));
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wash" aria-hidden>
              <Glyph path={FRIEND_PATH} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-label font-semibold">Meet a friend</span>
              <input
                value={friendNote}
                onChange={(event) => setFriendNote(event.target.value)}
                placeholder="Meeting Lisa after class"
                aria-label="Where are you meeting your friend"
                className="mt-1 w-full rounded-[10px] bg-wash px-3 py-[7px] text-meta outline-none"
              />
            </span>
            <button type="submit" className="shrink-0 rounded-full bg-primary px-3 py-[6px] text-meta font-semibold text-on-primary disabled:opacity-40" disabled={!friendNote.trim()}>
              Go
            </button>
          </form>
          <button type="button" onClick={() => choose({ kind: "wander", label: "Back here", to: studentSpot })} className="flex items-center gap-3 py-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wash" aria-hidden>
              <Glyph path={LOOP_PATH} />
            </span>
            <span>
              <span className="block text-label font-semibold">Just wander</span>
              <span className="block text-meta text-muted">Loop back to where you are</span>
            </span>
          </button>
        </div>
        <label className="mt-1 flex items-center gap-2 border-t border-hairline pt-3 text-meta text-muted">
          <span className="shrink-0 font-semibold text-ink">Leave</span>
          <select
            aria-label="When you leave"
            value={leaveAt ? "at" : "now"}
            onChange={(event) => {
              if (event.target.value === "now") setLeaveAt("");
              else if (!leaveAt) {
                const inAnHour = new Date(Date.now() + 60 * 60_000);
                inAnHour.setMinutes(0, 0, 0);
                const local = new Date(inAnHour.getTime() - inAnHour.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
                setLeaveAt(local);
              }
            }}
            className="rounded-[8px] bg-wash px-2 py-[5px] text-meta font-semibold text-ink"
          >
            <option value="now">Now</option>
            <option value="at">Depart at</option>
          </select>
          {leaveAt && (
            <input
              type="datetime-local"
              aria-label="Depart at"
              value={leaveAt}
              onChange={(event) => setLeaveAt(event.target.value)}
              className="min-w-0 flex-1 rounded-[8px] bg-wash px-2 py-[5px] text-meta text-ink"
            />
          )}
        </label>
      </div>
    );
  }

  if (step === "loading" || step === "error") {
    return (
      <div className={`${sheet} px-4 pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+20px)] pt-4`} role="status">
        <div className="flex items-center justify-between">
          <p className="text-label font-semibold">{step === "loading" ? "Muse is planning your walk..." : "Muse could not plan a walk right now."}</p>
          <button type="button" onClick={close} aria-label="Close food crawl" className="flex h-8 w-8 items-center justify-center rounded-full text-muted">
            <CloseIcon className="h-[14px] w-[14px]" />
          </button>
        </div>
        {step === "error" && (
          <button type="button" onClick={() => setStep("choose")} className="mt-2 text-meta font-semibold text-primary">
            Try another ending
          </button>
        )}
      </div>
    );
  }

  if (!plan) return null;
  const { route } = plan;
  const empty = route.stops.length === 0;

  return (
    <div className={`${sheet} flex max-h-[62%] flex-col pt-2`} role="dialog" aria-label="Your food crawl">
      <div className="mx-auto mb-2 h-1 w-8 shrink-0 rounded-full bg-divider" />
      <div className="flex shrink-0 items-start justify-between px-4">
        <div className="min-w-0">
          <h2 className="font-display text-title font-bold leading-[20px]">{empty ? "Nothing free on the way right now" : plan.pitch}</h2>
          <p className="mt-[3px] text-meta font-semibold text-muted">
            {route.stops.length} {route.stops.length === 1 ? "stop" : "stops"} · {route.totalWalkMinutes} min on the move · {route.destination.name} by{" "}
            {clock(route.destination.arriveAt)}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Close food crawl" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted">
          <CloseIcon className="h-[14px] w-[14px]" />
        </button>
      </div>

      <div role="tablist" aria-label="How you travel" className="mt-2 flex shrink-0 gap-[6px] px-4">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => changeMode(item.id)}
            className={`rounded-full px-[12px] py-[5px] text-meta font-semibold ${mode === item.id ? "bg-ink text-white" : "bg-wash text-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ol className="mt-2 min-h-0 flex-1 overflow-y-auto px-4">
        <li className="flex items-center gap-3 py-[7px]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
            <span className="h-3 w-3 rounded-full border-2 border-white bg-primary shadow-[0_0_0_4px_rgba(8,102,255,0.18)]" />
          </span>
          <span className="text-meta font-semibold">{fromLabel ?? "Your spot"} · leave {leaveAt || Number.isFinite(presetStartMs) ? clock(new Date(plan.startMs).toISOString()) : "now"}</span>
        </li>
        {route.stops.map((stop, index) => {
          const event = stop.eventId ? eventsById.get(stop.eventId) : undefined;
          const late = arrivesTooLate(stop);
          return (
            <li key={`${stop.eventId ?? stop.title}-${index}`} className="flex items-center gap-3 border-t border-hairline py-[8px]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e6b33] text-[11px] font-bold text-white">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label font-semibold">
                  <span className="mr-1 text-meta font-semibold text-[#1e6b33]">{KIND_LABELS[stop.kind] ?? "Stop"}</span>
                  {stop.title}
                </p>
                <p className="truncate text-meta text-muted">
                  {stop.walkMinutes} min {stop.mode === "walk" ? "walk" : stop.mode} · arrive {clock(stop.arriveAt)}
                  {event ? ` · until ${clock(event.endIso)}` : ""} · {stop.placeName}
                </p>
                {late && <p className="text-meta font-semibold text-badge">Ends before you get there</p>}
              </div>
              <button
                type="button"
                onClick={() => edit(removeStop(route, index, plan.startMs))}
                aria-label={`Remove ${stop.title}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wash"
              >
                <CloseIcon className="h-[12px] w-[12px]" />
              </button>
            </li>
          );
        })}
        <li className="flex items-center gap-3 border-t border-hairline py-[8px]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden>
            <Glyph path={ending?.friendName ? PERSON_PATH : HOME_PATH} className="h-[13px] w-[13px]" />
          </span>
          <span className="min-w-0 flex-1 truncate text-label font-semibold">{route.destination.name}</span>
          <span className="shrink-0 text-meta text-muted">
            {route.destination.walkMinutes} min · {clock(route.destination.arriveAt)}
          </span>
        </li>
        <li className="border-t border-hairline py-[8px]">
          {adding ? (
            addable.length === 0 ? (
              <p className="text-meta text-muted">Nothing else on nearby right now.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {addable.map(({ event, near }) => (
                  <li key={event.eventId}>
                    <button
                      type="button"
                      onClick={() => {
                        edit(
                          insertStop(
                            route,
                            {
                              eventId: event.eventId,
                              title: event.title,
                              kind: "added",
                              placeName: event.place.name,
                              lat: event.place.lat,
                              lng: event.place.lng,
                              startsAt: event.startIso,
                              endsAt: event.endIso,
                              arriveAt: "",
                              walkMinutes: 0,
                              mode: "walk",
                            },
                            plan.startMs,
                          ),
                        );
                        setAdding(false);
                      }}
                      className="flex w-full items-center justify-between rounded-[10px] bg-wash px-3 py-[7px] text-left"
                    >
                      <span className="min-w-0 truncate text-meta font-semibold">{event.title}</span>
                      <span className="ml-2 shrink-0 text-meta text-muted">{near} min off route</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="text-meta font-semibold text-primary">
              + Add stop
            </button>
          )}
        </li>
      </ol>

      <div className="flex shrink-0 gap-2 border-t border-hairline px-4 pb-[calc(var(--tabbar-height)+var(--tabbar-gap)+14px)] pt-3">
        <a
          href={googleDirectionsUrl(route, mode)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-[10px] bg-primary py-[9px] text-center text-label font-semibold text-on-primary"
        >
          Get directions
        </a>
        {ending?.friendId && ending.friendName && plan.invite.eventId ? (
          <button
            type="button"
            aria-live="polite"
            disabled={invited === "sending" || invited === "sent"}
            onClick={() => ending.friendId && plan.invite.eventId && void deliverInvite(ending.friendId, plan.invite.eventId, plan.invite.message)}
            className={`flex-1 rounded-[10px] py-[9px] text-label font-semibold ${invited === "sent" ? "bg-primary-soft text-link" : "bg-wash"}`}
          >
            {invited === "sent"
              ? `Invite sent to ${ending.friendName}`
              : invited === "sending"
                ? "Sending..."
                : invited === "error"
                  ? "Try sending again"
                  : `Send to ${ending.friendName}`}
          </button>
        ) : (
          <button type="button" onClick={() => void share()} className="flex-1 rounded-[10px] bg-wash py-[9px] text-label font-semibold">
            {shared ? "Invite ready" : "Send to a friend"}
          </button>
        )}
      </div>
    </div>
  );
}
