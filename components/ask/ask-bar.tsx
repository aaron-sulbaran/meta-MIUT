"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EventCard } from "@/components/events/event-card";
import { useVoiceRecorder } from "@/components/ask/use-voice-recorder";
import { CloseIcon, MuseMark } from "@/components/ui/icons";
import { updateAttendance } from "@/lib/attendance/client";
import { EVENT_FULL_ERROR } from "@/lib/attendance/schema";
import { getViewerId } from "@/lib/attendance/viewer";
import type { CampusEvent } from "@/lib/events/schema";
import { FEED_FILTER_EVENT, type AskAction, type AskReply, type MuseRouteResponse } from "@/lib/muse/types";

// Ask Muse on top of the Events tab: type a request, or tap the mic and say it.
// Speech goes to Muse Voice Transcribe, the words to Muse ask. Muse answers out
// loud and on the page (event titles link to the event), carries out what was
// asked (RSVP, interested, open, filter the list, plan my night), and asks a
// follow-up when the request is unclear; after a spoken request the mic reopens
// for the answer. Styling is a placeholder until the design lands (hub t-jvpd).

type Phase = "idle" | "transcribing" | "asking";
type Exchange = { id: number; question: string; reply: AskReply | null; error: string | null; done: string[]; planIds: string[] };
type CrawlReply = { data: { stops: { eventId: string }[]; pitch: string } | null; error: string | null };

const FILTER_LABELS = { forYou: "For you", free: "Free", today: "Today", week: "This week" } as const;

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} className={className}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
    </svg>
  );
}

function speak(text: string, then?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return then?.();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = () => then?.();
  utterance.onerror = () => then?.();
  window.speechSynthesis.speak(utterance);
}

/** The answer with each named event linked to its page. */
function linked(answer: string, mentioned: CampusEvent[]): ReactNode {
  const titles = mentioned.filter((event) => answer.includes(event.title)).sort((a, b) => b.title.length - a.title.length);
  if (titles.length === 0) return answer;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = answer.split(new RegExp(`(${titles.map((event) => escape(event.title)).join("|")})`));
  return parts.map((part, index) => {
    const event = titles.find((candidate) => candidate.title === part);
    return event ? (
      <Link key={index} href={`/events/${event.id}`} className="font-semibold text-primary">
        {part}
      </Link>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    );
  });
}

export function AskBar({ events, nowIso, placeholder }: { events: CampusEvent[]; nowIso: string; placeholder: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [thread, setThread] = useState<Exchange[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const byVoiceRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const byId = new Map(events.map((event) => [event.id, event]));
  const now = new Date(nowIso);
  const title = (id: string | null) => (id ? (byId.get(id)?.title ?? "that event") : "that event");

  const perform = useCallback(
    async (action: AskAction, reply: AskReply): Promise<{ note: string | null; planIds?: string[] }> => {
      const id = action.eventId;
      switch (action.type) {
        case "rsvp":
        case "cancel_rsvp": {
          if (!id) return { note: null };
          const going = action.type === "rsvp";
          const result = await updateAttendance(id, getViewerId(), going ? "rsvp" : "cancel_rsvp");
          if (result.error === EVENT_FULL_ERROR) return { note: `${title(id)} is full` };
          if (result.error !== null) return { note: `Couldn't update ${title(id)}` };
          await fetch(`/api/social/events/${encodeURIComponent(id)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ going }),
          }).catch(() => null);
          return { note: going ? `RSVP'd to ${title(id)}` : `Canceled RSVP for ${title(id)}` };
        }
        case "interested": {
          if (!id) return { note: null };
          const result = await updateAttendance(id, getViewerId(), "interested");
          return { note: result.error === null ? `Marked interested in ${title(id)}` : `Couldn't save ${title(id)}` };
        }
        case "open":
          if (id) router.push(`/events/${id}`);
          return { note: id ? `Opened ${title(id)}` : null };
        case "filter":
          if (!action.filter) return { note: null };
          window.dispatchEvent(new CustomEvent(FEED_FILTER_EVENT, { detail: action.filter }));
          return { note: `Showing ${FILTER_LABELS[action.filter]}` };
        case "plan_night": {
          if (!reply.plan) return { note: null };
          try {
            const response = await fetch("/api/muse/crawl", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...reply.plan, toLabel: "home" }),
            });
            if (response.status === 404) return { note: "The night planner isn't live yet" };
            const body = (await response.json()) as CrawlReply;
            if (!body.data) return { note: "Couldn't plan your night right now" };
            return { note: body.data.pitch, planIds: body.data.stops.map((stop) => stop.eventId) };
          } catch {
            return { note: "Couldn't plan your night right now" };
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, events],
  );

  const ask = useCallback(
    async (text: string) => {
      if (text.trim().length === 0) return;
      const id = Date.now();
      setPhase("asking");
      setQuestion("");
      let reply: AskReply | null = null;
      let error: string | null = null;
      try {
        const response = await fetch("/api/muse/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: text }),
        });
        const body = (await response.json()) as MuseRouteResponse<AskReply>;
        reply = body.data;
        error = body.data ? null : "Muse couldn't answer right now. Try again.";
      } catch {
        error = "Network error. Try again.";
      }
      setThread((current) => [...current, { id, question: text, reply, error, done: [], planIds: [] }].slice(-4));
      setPhase("idle");
      if (!reply) return;

      const spoken = [reply.answer, reply.followUp].filter(Boolean).join(" ");
      const listenAgain = reply.followUp !== null && byVoiceRef.current;
      speak(spoken, listenAgain ? () => startListeningRef.current() : undefined);

      for (const action of reply.actions) {
        const outcome = await perform(action, reply);
        if (!outcome.note) continue;
        setThread((current) =>
          current.map((exchange) =>
            exchange.id === id
              ? { ...exchange, done: [...exchange.done, outcome.note!], planIds: outcome.planIds ?? exchange.planIds }
              : exchange,
          ),
        );
      }
    },
    [perform],
  );

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
        byVoiceRef.current = true;
        await ask(transcript);
      } catch {
        setVoiceError("Network error. Type it instead.");
        setPhase("idle");
      }
    },
    [ask],
  );

  const voice = useVoiceRecorder(onClip);
  const startListening = voice.start;
  useEffect(() => {
    startListeningRef.current = () => void startListening();
  }, [startListening]);
  const busy = phase !== "idle";

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    byVoiceRef.current = false;
    void ask(question);
  }

  function close() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setThread([]);
  }

  const status = voice.recording ? "Listening… tap the mic when you're done" : phase === "transcribing" ? "Hearing you…" : phase === "asking" ? "Muse is on it…" : null;

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
          placeholder={thread.at(-1)?.reply?.followUp ? "Answer Muse…" : `Ask Muse, like "${placeholder}"`}
          enterKeyHint="send"
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
        {thread.length > 0 && (
          <div className="mt-[8px] rounded-card border border-hairline bg-card p-3">
            <div className="flex justify-end">
              <button type="button" onClick={close} aria-label="Close Muse" className="text-muted">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <ol className="flex flex-col gap-3">
              {thread.map((exchange) => {
                const mentioned = (exchange.reply?.eventIds ?? []).map((id) => byId.get(id)).filter((event) => event !== undefined);
                const planned = exchange.planIds.map((id) => byId.get(id)).filter((event) => event !== undefined);
                return (
                  <li key={exchange.id} className="flex flex-col gap-[6px]">
                    <p className="self-end rounded-[14px] bg-wash px-3 py-[6px] text-body">{exchange.question}</p>
                    {exchange.reply ? (
                      <>
                        <p className="text-body" data-muse-answer>
                          {linked(exchange.reply.answer, mentioned)}
                        </p>
                        {exchange.reply.followUp && <p className="text-body font-semibold">{exchange.reply.followUp}</p>}
                      </>
                    ) : (
                      <p className="text-body text-[#e41e3f]">{exchange.error}</p>
                    )}
                    {exchange.done.map((note) => (
                      <p key={note} className="text-meta font-semibold text-muted">
                        ✓ {note}
                      </p>
                    ))}
                    {[...mentioned, ...planned.filter((event) => !mentioned.includes(event))].map((event) => (
                      <EventCard key={event.id} event={event} now={now} />
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
