"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { EventCard } from "@/components/events/event-card";
import { useVoiceRecorder } from "@/components/ask/use-voice-recorder";
import { CloseIcon, MuseMark } from "@/components/ui/icons";
import { updateAttendance } from "@/lib/attendance/client";
import { EVENT_FULL_ERROR } from "@/lib/attendance/schema";
import { getViewerId } from "@/lib/attendance/viewer";
import { EVERYONE, personNamedIn } from "@/lib/social/fixtures/people";
import type { CampusEvent } from "@/lib/events/schema";
import { FEED_FILTER_EVENT, type AskAction, type AskReply, type MuseRouteResponse } from "@/lib/muse/types";

// Ask Muse (the /ask screen): type a request, or tap the mic and say it.
// Speech goes to Muse Voice Transcribe, the words to Muse ask. Muse answers out
// loud and on the page (event titles link to the event), carries out what was
// asked (RSVP, interested, open, filter the list, plan my night, draft an event
// they are hosting on the organizer screen), and asks a
// follow-up when the request is unclear; after a spoken request the mic reopens
// for the answer. Styling is a placeholder until the design lands (hub t-jvpd).

type Phase = "idle" | "transcribing" | "asking";
type Exchange = { id: number; question: string; reply: AskReply | null; error: string | null; done: string[]; planIds: string[]; links: { label: string; href: string }[] };
type CrawlReply = { data: { stops: { eventId: string }[]; pitch: string } | null; error: string | null };

// The conversation on screen survives opening an event and coming back.
const THREAD_KEY = "ask-muse-thread";
// Set when the student opens an event from Muse, so Back returns to the same conversation.
const KEEP_KEY = "ask-muse-keep";

const FILTER_LABELS = { forYou: "For you", free: "Free", today: "Today", week: "This week" } as const;

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} className={className}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
    </svg>
  );
}

// Meta Model API has no text to speech (Muse Voice Transcribe is speech to
// text only), so Muse speaks with the most humanlike voice the browser has:
// the neural ones (Edge "Natural", Chrome "Google", Safari "Premium") first.
const HUMANLIKE = [/natural|neural/i, /premium|enhanced|siri/i, /google us english/i, /\b(ava|aria|jenny|samantha|zoe|allison)\b/i, /google/i];

function humanlikeVoice(): SpeechSynthesisVoice | null {
  const english = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  for (const pattern of HUMANLIKE) {
    const match = english.find((voice) => pattern.test(voice.name) && voice.lang.toLowerCase() === "en-us") ?? english.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return english.find((voice) => voice.lang.toLowerCase() === "en-us") ?? english[0] ?? null;
}

/** Spoken like talk, not a reading: no arrows or symbols, short pauses at dashes. */
export function forSpeech(text: string): string {
  return text
    .replace(/[→•✓]/g, "")
    .replace(/\s[—–-]\s/g, ", ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Chrome loads its voices late; asking once starts the load.
  window.speechSynthesis.getVoices();
}

function speak(text: string, then?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return then?.();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(forSpeech(text));
  const voice = humanlikeVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 1.05;
  utterance.pitch = 1;
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
      <Link key={index} href={`/events/${event.id}?from=ask`} className="font-semibold text-primary">
        {part}
      </Link>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    );
  });
}

/** What a "plan my night" hands over when a host (the map's Ask popup) draws the plan itself. */
export type AskPlan = NonNullable<AskReply["plan"]>;

export function AskBar({
  events,
  nowIso,
  placeholder,
  docked = false,
  onPlan,
}: {
  events: CampusEvent[];
  nowIso: string;
  /** An example question; the box then reads Ask Muse, like "...". */
  placeholder?: string;
  /** The text box sits at the bottom of the screen under the conversation (the Ask Muse page). */
  docked?: boolean;
  /** When set, plan_night goes to the host (the map draws the route) instead of a list here; invite is set when the student also asked to invite a friend. */
  onPlan?: (plan: AskPlan, question: string, options: { invite: boolean }) => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [thread, setThread] = useState<Exchange[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const byVoiceRef = useRef(false);
  const restoredRef = useRef(false);
  const mountedRef = useRef(true);
  const freshRef = useRef(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = window.sessionStorage.getItem(KEEP_KEY) ? window.sessionStorage.getItem(THREAD_KEY) : null;
      window.sessionStorage.removeItem(KEEP_KEY);
      if (saved) {
        freshRef.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThread(JSON.parse(saved) as Exchange[]);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      window.sessionStorage.setItem(THREAD_KEY, JSON.stringify(thread));
    } catch {}
  }, [thread]);
  const startListeningRef = useRef<() => void>(() => {});
  function keepConversation() {
    try {
      window.sessionStorage.setItem(KEEP_KEY, "1");
    } catch {}
  }
  function keepIfOpeningEvent(click: MouseEvent<HTMLElement>) {
    if ((click.target as Element).closest('a[href*="from=ask"]')) keepConversation();
  }
  const byId = new Map(events.map((event) => [event.id, event]));
  const now = new Date(nowIso);
  const title = (id: string | null) => (id ? (byId.get(id)?.title ?? "that event") : "that event");

  const perform = useCallback(
    async (action: AskAction, reply: AskReply, question: string): Promise<{ note: string | null; planIds?: string[]; link?: { label: string; href: string } }> => {
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
          if (id) {
            keepConversation();
            router.push(`/events/${id}?from=ask`);
          }
          return { note: id ? `Opened ${title(id)}` : null };
        case "filter":
          if (!action.filter) return { note: null };
          if (window.location.pathname !== "/") {
            const href = action.filter === "free" ? "/?view=list&chip=free" : "/?view=list";
            return { note: null, link: { label: `See ${FILTER_LABELS[action.filter]} in the list`, href } };
          }
          window.dispatchEvent(new CustomEvent(FEED_FILTER_EVENT, { detail: action.filter }));
          return { note: `Showing ${FILTER_LABELS[action.filter]}` };
        case "create_event":
          router.push(`/organizer?say=${encodeURIComponent(question)}`);
          return { note: "Drafting your event" };
        case "invite_friend": {
          // With a walk to plan, the map sends the invite once Muse has picked the stop.
          if (reply.actions.some((other) => other.type === "plan_night")) return { note: null };
          const friend = personNamedIn(question, EVERYONE);
          if (!friend || !id) return { note: null };
          const sent = await fetch("/api/social/invites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ to: friend.id, eventId: id }),
          }).catch(() => null);
          return { note: sent?.ok ? `Sent ${friend.name} the invite to ${title(id)}` : `Couldn't send ${friend.name} the invite` };
        }
        case "plan_night": {
          if (!reply.plan) return { note: null };
          const invite = reply.actions.some((other) => other.type === "invite_friend");
          const link = {
            label: "Open the walk on the map",
            href: `/?plan=ask&note=${encodeURIComponent(question.slice(0, 300))}${id ? `&to=${encodeURIComponent(id)}` : ""}${invite ? "&invite=1" : ""}`,
          };
          if (onPlan) {
            onPlan(reply.plan, question, { invite });
            return { note: invite ? "Planning it on the map, then sending the invite" : "Planning it on the map" };
          }
          try {
            const response = await fetch("/api/muse/crawl", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...reply.plan, toLabel: "home" }),
            });
            if (!response.ok) return { note: null, link };
            const body = (await response.json()) as CrawlReply;
            if (!body.data) return { note: null, link };
            return { note: body.data.pitch, planIds: body.data.stops.map((stop) => stop.eventId), link };
          } catch {
            return { note: null, link };
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, events, onPlan],
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
          body: JSON.stringify({ question: text, fresh: freshRef.current }),
        });
        const body = (await response.json()) as MuseRouteResponse<AskReply>;
        reply = body.data;
        error = body.data ? null : "Muse couldn't answer right now. Try again.";
      } catch {
        error = "Network error. Try again.";
      }
      if (reply) freshRef.current = false;
      setThread((current) => [...current, { id, question: text, reply, error, done: [], planIds: [], links: [] }].slice(docked ? -20 : -4));
      setPhase("idle");
      if (!reply) return;

      const spoken = [reply.answer, reply.followUp].filter(Boolean).join(" ");
      const leaving = reply.actions.some((action) => action.type === "open" || action.type === "create_event");
      const listenAgain = byVoiceRef.current && !leaving;
      speak(spoken, listenAgain ? () => mountedRef.current && byVoiceRef.current && startListeningRef.current() : undefined);

      for (const action of reply.actions) {
        const outcome = await perform(action, reply, text);
        if (!outcome.note && !outcome.link) continue;
        setThread((current) =>
          current.map((exchange) =>
            exchange.id === id
              ? {
                  ...exchange,
                  done: outcome.note ? [...exchange.done, outcome.note] : exchange.done,
                  planIds: outcome.planIds ?? exchange.planIds,
                  links: outcome.link ? [...exchange.links, outcome.link] : exchange.links,
                }
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

  const onNoSpeech = useCallback(() => setPaused(true), []);
  const voice = useVoiceRecorder(onClip, onNoSpeech);
  const startListening = voice.start;
  const listen = useCallback(() => {
    setPaused(false);
    void startListening({ autoStop: true });
  }, [startListening]);
  useEffect(() => {
    startListeningRef.current = listen;
  }, [listen]);

  function tapMic() {
    if (voice.recording) return voice.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    listen();
  }
  const busy = phase !== "idle";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (docked && thread.length > 0) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [docked, thread]);

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    byVoiceRef.current = false;
    void ask(question);
  }

  function close() {
    byVoiceRef.current = false;
    freshRef.current = true;
    voice.cancel();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setThread([]);
  }

  const status = voice.recording
    ? "Listening… pause when you're done, or tap the mic"
    : paused
      ? "Stopped listening. Tap the mic to talk again."
      : phase === "transcribing" ? "Hearing you…" : phase === "asking" ? "Muse is on it…" : null;

  const formEl = (
      <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-wash py-[6px] pl-3 pr-[6px]">
      <MuseMark className="h-5 w-5 shrink-0 text-primary" />
      <label htmlFor="ask-muse-bar" className="sr-only">
        Ask Muse about events
      </label>
      <input
        id="ask-muse-bar"
        value={question}
        onChange={(change) => setQuestion(change.target.value)}
        placeholder={thread.at(-1)?.reply?.followUp ? "Answer Muse…" : placeholder ? `Ask Muse, like "${placeholder}"` : "Ask Muse"}
        enterKeyHint="send"
        disabled={busy || voice.recording}
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
      />
      {voice.supported && (
        <button
          type="button"
          onClick={tapMic}
          disabled={busy}
          aria-label={voice.recording ? "Stop and ask" : "Ask by voice"}
          aria-pressed={voice.recording}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${voice.recording ? "bg-primary text-white" : "text-muted"} disabled:opacity-50`}
        >
          <MicIcon className="h-[18px] w-[18px]" />
        </button>
      )}
    </form>
  );
  const statusEl = (
    <>
        {status && <p className="mt-[6px] px-1 text-meta text-muted">{status}</p>}
        {(voice.error ?? voiceError) && <p className="mt-[6px] px-1 text-meta text-[#e41e3f]">{voice.error ?? voiceError}</p>}
    </>
  );

  return (
    <section aria-label="Ask Muse" className={docked ? "flex flex-col px-3 pt-[10px]" : "px-3 pt-[10px]"} onClickCapture={keepIfOpeningEvent}>
      {!docked && formEl}
      <div aria-live="polite">
        {!docked && statusEl}
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
                    {exchange.links.map((link) => (
                      <Link key={link.href} href={link.href} className="text-meta font-semibold text-primary">
                        {link.label} →
                      </Link>
                    ))}
                    {[...mentioned, ...planned.filter((event) => !mentioned.includes(event))].map((event) => (
                      <EventCard key={event.id} event={event} now={now} from="ask" />
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <div ref={endRef} className="scroll-mb-[calc(var(--tabbar-height)+var(--tabbar-gap)+72px)]" />
      </div>
      {docked && (
        <div className="sticky bottom-[calc(var(--tabbar-height)+var(--tabbar-gap)+8px)] mt-2 bg-page pb-1 pt-1">
          {statusEl}
          {formEl}
        </div>
      )}
    </section>
  );
}
