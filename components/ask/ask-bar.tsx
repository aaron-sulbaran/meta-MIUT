"use client";

import { useCallback, useState, type FormEvent } from "react";
import { EventCard } from "@/components/events/event-card";
import { useVoiceRecorder } from "@/components/ask/use-voice-recorder";
import { CloseIcon, MuseMark } from "@/components/ui/icons";
import type { CampusEvent } from "@/lib/events/schema";
import type { MuseRouteResponse } from "@/lib/muse/types";

// Ask Muse on top of the Events tab: type a question, or tap the mic and say it.
// Speech goes to Muse Voice Transcribe, the words go to Muse ask, and the answer
// comes back as one line plus the matching event cards. Styling is a placeholder
// until the design lands (hub t-jvpd).

type AskAnswer = { answer: string; eventIds: string[] };
type Phase = "idle" | "transcribing" | "asking";

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} className={className}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
    </svg>
  );
}

export function AskBar({ events, nowIso, placeholder }: { events: CampusEvent[]; nowIso: string; placeholder: string }) {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<MuseRouteResponse<AskAnswer> | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const byId = new Map(events.map((event) => [event.id, event]));
  const now = new Date(nowIso);

  const ask = useCallback(async (text: string) => {
    if (text.trim().length === 0) return;
    setPhase("asking");
    try {
      const response = await fetch("/api/muse/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      setResult((await response.json()) as MuseRouteResponse<AskAnswer>);
    } catch {
      setResult({ data: null, error: "Network error" });
    } finally {
      setPhase("idle");
    }
  }, []);

  const onClip = useCallback(
    async (wav: Blob) => {
      setPhase("transcribing");
      setVoiceError(null);
      try {
        const form = new FormData();
        form.append("audio", wav, "question.wav");
        const response = await fetch("/api/muse/transcribe", { method: "POST", body: form });
        const body = (await response.json()) as MuseRouteResponse<{ transcript: string }>;
        const transcript = body.data?.transcript ?? "";
        if (transcript.length === 0) {
          setVoiceError(body.error ? "Muse couldn't hear that. Try again, or type it." : "Didn't catch that. Try again, or type it.");
          setPhase("idle");
          return;
        }
        setQuestion(transcript);
        await ask(transcript);
      } catch {
        setVoiceError("Network error. Type it instead.");
        setPhase("idle");
      }
    },
    [ask],
  );

  const voice = useVoiceRecorder(onClip);
  const busy = phase !== "idle";

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    void ask(question);
  }

  const status = voice.recording ? "Listening… tap the mic to stop" : phase === "transcribing" ? "Hearing you…" : phase === "asking" ? "Asking Muse…" : null;
  const shown = result?.data?.eventIds.map((id) => byId.get(id)).filter((event) => event !== undefined) ?? [];

  return (
    <section aria-label="Ask Muse" className="px-3 pt-[10px]">
      <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-wash py-[6px] pl-3 pr-[6px]">
        <MuseMark className="h-5 w-5 shrink-0 text-primary" />
        <label htmlFor="ask-muse-bar" className="sr-only">
          Ask Muse about events
        </label>
        <input
          id="ask-muse-bar"
          value={question}
          onChange={(change) => setQuestion(change.target.value)}
          placeholder={`Ask Muse, like "${placeholder}"`}
          enterKeyHint="search"
          disabled={busy || voice.recording}
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={() => (voice.recording ? voice.stop() : void voice.start())}
            disabled={busy}
            aria-label={voice.recording ? "Stop and ask" : "Ask by voice"}
            aria-pressed={voice.recording}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${voice.recording ? "bg-primary text-white" : "text-muted"} disabled:opacity-50`}
          >
            <MicIcon className="h-[18px] w-[18px]" />
          </button>
        )}
      </form>

      <div aria-live="polite">
        {status && <p className="mt-[6px] px-1 text-meta text-muted">{status}</p>}
        {(voice.error ?? voiceError) && <p className="mt-[6px] px-1 text-meta text-[#e41e3f]">{voice.error ?? voiceError}</p>}
        {result && !busy && (
          <div className="mt-[8px] rounded-card border border-hairline bg-card p-3">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-body">{result.data ? result.data.answer : "Muse couldn't answer right now. Try again."}</p>
              <button type="button" onClick={() => setResult(null)} aria-label="Close answer" className="text-muted">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            {shown.length > 0 && (
              <div className="mt-[8px] flex flex-col gap-[7.6px]">
                {shown.map((event) => (
                  <EventCard key={event.id} event={event} now={now} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
