"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { InstagramPostIcon } from "@/components/ui/icons";
import { friendsGoingLine, sharedLine, type WhoIsGoing } from "@/lib/social/types";

// The event page's Who's going section: friends going first, then students
// going who are open to company, with Say hi. Going and Open to company (a
// checkbox only, no note, per lisa) are
// set here for the demo viewer. This is the page's only going button: on an
// RSVP event it reads RSVP, then You're going (lisa). With showCompany={false}
// the Looking for company list is left out, so the page can place it with
// LookingForCompany further down.

type Response = { data: WhoIsGoing | null; error: string | null };

async function post(url: string, body: unknown): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as Response;
  } catch {
    return { data: null, error: "Network error" };
  }
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-card bg-wash font-display text-label font-bold"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function WhosGoing({
  initial,
  rsvp = false,
  capacity,
  showCompany = true,
}: {
  initial: WhoIsGoing;
  rsvp?: boolean;
  capacity?: number;
  showCompany?: boolean;
}) {
  const [who, setWho] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(url: string, body: unknown) {
    setBusy(true);
    const result = await post(url, body);
    setBusy(false);
    setError(result.error);
    if (result.data) setWho(result.data);
  }

  const goingUrl = `/api/social/events/${encodeURIComponent(who.eventId)}`;
  const setGoing = (going: boolean, open = who.viewer.open) => run(goingUrl, { going, open });

  return (
    <section aria-labelledby="whos-going-heading" className="px-3">
      <h2 id="whos-going-heading" className="font-display text-title font-bold">
        Who&apos;s going
      </h2>

      {who.friends.length > 0 ? (
        <div className="mt-[10px] flex items-center gap-[10px]">
          <div className="flex -space-x-[10px]">
            {who.friends.slice(0, 4).map((friend) => (
              <Avatar key={friend.id} name={friend.name} />
            ))}
          </div>
          <p className="text-body font-semibold">{friendsGoingLine(who.friends)}</p>
        </div>
      ) : (
        <p className="mt-[8px] text-body text-muted">None of your friends yet. Be the first.</p>
      )}

      <div className="mt-[12px] rounded-card border border-hairline p-3">
        <button
          type="button"
          aria-pressed={who.viewer.going}
          disabled={busy}
          onClick={() => setGoing(!who.viewer.going, false)}
          className={buttonClass(who.viewer.going ? "soft" : "primary", "w-full")}
        >
          {who.viewer.going ? "You're going" : rsvp ? "RSVP" : "I'm going"}
        </button>
        {rsvp && !who.viewer.going && (
          <p className="mt-[6px] text-meta text-muted">
            {capacity ? `RSVP required, ${capacity} spots.` : "RSVP required."} Your RSVP saves your spot.
          </p>
        )}
        {who.viewer.going && (
          <div className="mt-[10px]">
            <label className="flex items-center justify-between gap-[10px] text-body font-semibold">
              Open to company
              <input
                type="checkbox"
                checked={who.viewer.open}
                disabled={busy}
                onChange={(change) => setGoing(true, change.target.checked)}
                className="h-[20px] w-[20px] accent-current"
              />
            </label>
            <p className="mt-[2px] text-meta text-muted">
              Students going can see your first name and the interests you share, and say hi.
            </p>
          </div>
        )}
      </div>

      {showCompany && <CompanyList who={who} busy={busy} run={run} />}

      {who.othersCount > 0 && (
        <p className="mt-[10px] text-meta text-muted">
          + {who.othersCount} more {who.othersCount === 1 ? "student" : "students"} going
        </p>
      )}
      {error && <p className="mt-[8px] text-meta text-muted">{error}</p>}
    </section>
  );
}

function CompanyList({
  who,
  busy,
  run,
  heading = "h3",
}: {
  who: WhoIsGoing;
  busy: boolean;
  run: (url: string, body: unknown) => Promise<void>;
  heading?: "h2" | "h3";
}) {
  if (who.openToCompany.length === 0) return null;
  const Heading = heading;
  return (
    <>
      <Heading className={heading === "h2" ? "font-display text-title font-bold" : "mt-[16px] font-display text-label font-bold"}>
        Looking for company
      </Heading>
      <p className="text-meta text-muted">Top students going by interests you share</p>
      <ul className="mt-[8px] flex flex-col gap-[10px]">
        {who.openToCompany.map((person) => (
          <li key={person.id} className="flex items-start gap-[10px] rounded-card border border-hairline p-[10px]">
            <Avatar name={person.name} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-label font-bold">{person.name}</p>
              <p className="text-meta font-semibold text-muted">
                {person.year} · {person.major}
              </p>
              <p className="mt-[2px] text-meta">{sharedLine(person.shared)}</p>
              {person.note && <p className="mt-[2px] text-meta text-muted">&ldquo;{person.note}&rdquo;</p>}
              {person.instagram && (
                <p className="mt-[4px] flex items-center gap-[5px] text-meta font-semibold">
                  <InstagramPostIcon className="h-[15px] w-[15px] shrink-0" />
                  They said yes: @{person.instagram}
                </p>
              )}
            </div>
            {!person.hello && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run("/api/social/hello", { eventId: who.eventId, to: person.id })}
                className={buttonClass("secondary", "shrink-0")}
              >
                Say hi
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Looking for company as its own section, for pages that place it after Details. */
export function LookingForCompany({ initial }: { initial: WhoIsGoing }) {
  const [who, setWho] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, body: unknown) {
    setBusy(true);
    const result = await post(url, body);
    setBusy(false);
    setError(result.error);
    if (result.data) setWho(result.data);
  }

  if (who.openToCompany.length === 0) return null;
  return (
    <section aria-label="Looking for company" className="px-3">
      <CompanyList who={who} busy={busy} run={run} heading="h2" />
      {error && <p className="mt-[8px] text-meta text-muted">{error}</p>}
    </section>
  );
}
