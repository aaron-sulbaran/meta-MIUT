"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CastAvatar } from "@/components/demo/cast-avatar";
import { PHONE_CAST, phonePath } from "@/lib/demo/beat-context";
import { CAST, type CastId } from "@/lib/demo/beats";

// The operator console's link sheet: each presenter's personal phone link
// (/demo/phone/<slug>) with a copy button, and whether that phone is open now
// (it checked in with the stage in the last few seconds).

// Phones stamp themselves at most every 15 s (lib/demo/stage-position.ts), so a phone counts as open for 40 s.
const POLL_MS = 10_000;
const CONNECTED_MS = 40_000;

const noSubscribe = () => () => {};

export function PhoneLinks() {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [seen, setSeen] = useState<Partial<Record<CastId, string | null>>>({});
  const [copied, setCopied] = useState<CastId | null>(null);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/demo/stage?phones=1", { cache: "no-store" });
        const body = (await response.json()) as { phones?: Partial<Record<CastId, string | null>> };
        if (!stopped && body.phones) setSeen(body.phones);
      } catch {
        // Keep the last answer; the dots go grey on their own as stamps age.
      }
      if (!stopped) setClock(Date.now());
    }
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  async function copy(id: CastId) {
    try {
      await navigator.clipboard.writeText(`${origin}${phonePath(id)}`);
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1_500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-card p-4">
      <h3 className="text-[15px] font-semibold">Presenter phones</h3>
      <p className="text-[13px] text-muted">Text each person their link. On their beats their phone shows their screen and their taps move the stage.</p>
      <ul className="flex flex-col gap-2">
        {PHONE_CAST.map((id) => {
          const at = seen[id];
          const connected = Boolean(at && clock - Date.parse(at) < CONNECTED_MS);
          return (
            <li key={id} className="flex items-center gap-3 rounded-[10px] border border-hairline px-3 py-2">
              <CastAvatar id={id} size={32} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold">
                  {CAST[id].name}
                  <span className={`h-[8px] w-[8px] rounded-full ${connected ? "bg-[#31a24c]" : "bg-[#bcc0c4]"}`} aria-hidden />
                  <span className="text-[12px] font-normal text-muted">{connected ? "Connected" : "Not open"}</span>
                </p>
                <p className="truncate text-[12px] text-muted">{origin}{phonePath(id)}</p>
              </div>
              <button type="button" onClick={() => void copy(id)} className="h-[32px] shrink-0 rounded-button bg-button px-3 text-[13px] font-semibold">
                {copied === id ? "Copied" : "Copy"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
