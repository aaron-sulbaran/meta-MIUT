"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { InstagramPostIcon } from "@/components/ui/icons";
import { friendsGoingLine, type WhoIsGoing } from "@/lib/social/types";

// The event page's Who's going section: friends going first, then students
// going who are open to company, with Say hi. Going and Open to company are
// set here for the demo viewer.

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

export function WhosGoing({ initial }: { initial: WhoIsGoing }) {
  const [who, setWho] = useState(initial);
  const [note, setNote] = useState(initial.viewer.note ?? "");
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
  const setGoing = (going: boolean, open = who.viewer.open) =>
    run(goingUrl, { going, open, ...(open && note.trim() ? { note: note.trim() } : {}) });

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
          {who.viewer.going ? "You're going" : "I'm going"}
        </button>
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
            {who.viewer.open && (
              <div className="mt-[8px] flex gap-[7.6px]">
                <input
                  type="text"
                  value={note}
                  maxLength={120}
                  placeholder="Looking for people to go with"
                  onChange={(change) => setNote(change.target.value)}
                  className="min-w-0 flex-1 rounded-card border border-hairline px-[10px] py-[6px] text-body"
                />
                <button type="button" disabled={busy} onClick={() => setGoing(true, true)} className={buttonClass("secondary")}>
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {who.openToCompany.length > 0 && (
        <>
          <h3 className="mt-[16px] font-display text-label font-bold">Looking for company</h3>
          <ul className="mt-[8px] flex flex-col gap-[10px]">
            {who.openToCompany.map((person) => (
              <li key={person.id} className="flex items-start gap-[10px] rounded-card border border-hairline p-[10px]">
                <Avatar name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-label font-bold">{person.name}</p>
                  <p className="text-meta font-semibold text-muted">
                    {person.year} · {person.major}
                  </p>
                  {person.shared.length > 0 && <p className="mt-[2px] text-meta">Both into {person.shared.join(", ")}</p>}
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
      )}

      {who.othersCount > 0 && (
        <p className="mt-[10px] text-meta text-muted">
          + {who.othersCount} more {who.othersCount === 1 ? "student" : "students"} going
        </p>
      )}
      {error && <p className="mt-[8px] text-meta text-muted">{error}</p>}
    </section>
  );
}
