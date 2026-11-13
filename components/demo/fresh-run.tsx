"use client";

import { useEffect, useState } from "react";
import { isStaleRun, lastMoveLabel, readResetToken, requestFreshRun, saveResetToken, type RunStamp } from "@/lib/demo/run";

// "Start a fresh run" for the console and the remote (lib/demo/run.ts): a confirm step
// on the page, the reset token kept in this browser after it is entered once, a short
// note naming what was cleared, and a warning when the record is an old run. Every open
// stage, phone and remote moves to the new run on its own within a second or two.

const STALE_CHECK_MS = 10_000;

/** The stage record every few seconds, for the stale-run warning. */
function useStageRecord(): RunStamp | null {
  const [position, setPosition] = useState<RunStamp | null>(null);
  useEffect(() => {
    let stopped = false;
    const read = async () => {
      try {
        const response = await fetch("/api/demo/stage", { cache: "no-store" });
        const body = (await response.json()) as { data: RunStamp | null };
        if (!stopped) setPosition(body.data);
      } catch {
        // Offline: keep the last answer.
      }
    };
    void read();
    const timer = setInterval(read, STALE_CHECK_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  return position;
}

export function FreshRun({ compact = false }: { compact?: boolean }) {
  const position = useStageRecord();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [askToken, setAskToken] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; cleared?: readonly string[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const saved = readResetToken();
    // Reading this browser's storage once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasToken(saved !== "");
    const timer = setInterval(() => setNow(Date.now()), STALE_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const stale = isStaleRun(position, now);

  async function start() {
    setBusy(true);
    setMessage(null);
    const typed = token.trim();
    const result = await requestFreshRun(typed || readResetToken());
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      if (result.needsToken) {
        saveResetToken("");
        setHasToken(false);
        setAskToken(true);
      }
      setMessage({ ok: false, text: result.message });
      return;
    }
    if (typed) {
      saveResetToken(typed);
      setHasToken(true);
      setToken("");
      setAskToken(false);
    }
    setMessage({ ok: true, text: "Fresh run started. Every open stage and phone moves to it within a few seconds. Cleared:", cleared: result.cleared });
  }

  const showTokenField = askToken || (!compact && !hasToken);
  const primary = "rounded-[10px] bg-primary px-4 py-2.5 font-display text-label font-bold text-on-primary disabled:opacity-60";
  const secondary = "rounded-[10px] bg-button px-4 py-2.5 font-display text-label font-bold disabled:opacity-60";

  return (
    <section className={`flex flex-col gap-2 rounded-lg bg-card ${compact ? "p-3" : "p-4"}`} aria-label="Fresh run">
      {!compact && <h2 className="text-[17px] font-bold">Start a fresh run</h2>}
      {stale && (
        <p role="status" className="rounded-[8px] bg-[#fff4e5] px-3 py-2 text-[13px] font-semibold text-[#8a4b00]">
          This is an old run: the show last moved {lastMoveLabel(position, now)}. Start a fresh run before the pitch.
        </p>
      )}
      {!compact && (
        <p className="text-[13px] text-muted">
          Clears every run before this one, everywhere, and puts the stage and every phone back on the first beat. Run it once right before the pitch.
        </p>
      )}
      {showTokenField && (
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          {hasToken ? "Reset token" : "Reset token (deployed site only; kept in this browser after the first fresh run)"}
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded-md border border-divider bg-card p-2 text-[15px] text-ink"
            value={token}
            onChange={(change) => setToken(change.target.value)}
          />
        </label>
      )}
      {!compact && hasToken && !askToken && <p className="text-[12px] text-muted">The reset token is kept in this browser.</p>}
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">Clear everything from earlier runs and start over?</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={primary} onClick={() => void start()}>
              {busy ? "Starting..." : "Yes, start fresh"}
            </button>
            <button type="button" disabled={busy} className={secondary} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy} className={stale || !compact ? primary : secondary} onClick={() => setConfirming(true)}>
          Start a fresh run
        </button>
      )}
      {message && (
        <div role="status" className={`text-[13px] ${message.ok ? "text-ink" : "font-semibold text-[#c4122f]"}`}>
          <p>{message.text}</p>
          {message.cleared && (
            <ul className="mt-1 list-disc pl-5 text-muted">
              {message.cleared.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
