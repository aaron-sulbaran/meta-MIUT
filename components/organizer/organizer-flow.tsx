"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DraftCard } from "@/components/organizer/draft-card";
import { prepareFlyer } from "@/components/organizer/flyer-image";
import { MuseMaking, type MakingState } from "@/components/organizer/muse-making";
import type { ExtractDraft, ExtractDraftsResponse, FlyerImage, InputMode, OrganizerOption } from "@/components/organizer/types";
import { useSpeechInput } from "@/components/organizer/use-speech-input";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ui/card";
import { FilterChip } from "@/components/ui/chips";
import { PhotoIcon } from "@/components/ui/icons";
import type { KnownPlace } from "@/lib/organizer/place";

// The organizer side of the demo: a flyer photo (with its caption) or a spoken line in,
// Muse drafts every event in it, the organizer checks the flagged fields and publishes.
// A handoff (the demo's staged Instagram post, ?handoff=story) brings its own flyer and
// caption: no picker, Muse starts at once behind the "making your event" card (O3).

/** A post handed over from the staged Instagram screen: its flyer, caption, and club. */
export type OrganizerHandoff = { flyerSrc: string; caption: string; organizer: OrganizerOption };

const NO_CAPTION = "(No caption. Read everything from the flyer image.)";

type Result = {
  run: number;
  mode: InputMode;
  caption: string;
  drafts: ExtractDraft[];
  // Sessions of a series that already ended (a term-long class lists every week).
  skippedPast: number;
  live: boolean;
  fallbackReason: string | null;
  error: string | null;
};

const fieldClass =
  "w-full min-w-0 rounded-[8px] border border-divider bg-card px-[10px] py-[9px] text-body text-ink placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-primary";

export function OrganizerFlow({
  places,
  organizers,
  eventTitles,
  sampleCaption,
  said = "",
  handoff = null,
}: {
  places: KnownPlace[];
  organizers: OrganizerOption[];
  eventTitles: Record<string, string>;
  sampleCaption: string;
  // A spoken line from Ask Muse, drafted as soon as the screen opens.
  said?: string;
  handoff?: OrganizerHandoff | null;
}) {
  const fallbackOrganizer: OrganizerOption = { name: "Your club", handle: "your_club" };
  const [organizerHandle, setOrganizerHandle] = useState(handoff?.organizer.handle ?? organizers[0]?.handle ?? fallbackOrganizer.handle);
  const organizer = organizers.find((option) => option.handle === organizerHandle) ?? organizers[0] ?? fallbackOrganizer;

  const [mode, setMode] = useState<InputMode>(said ? "voice" : "photo");
  const [flyer, setFlyer] = useState<FlyerImage | null>(null);
  const [flyerNote, setFlyerNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [spoken, setSpoken] = useState(said);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [making, setMaking] = useState<MakingState | null>(null);

  const speech = useSpeechInput(useCallback((text: string) => setSpoken(text), []));

  async function pickFlyer(file: File | undefined) {
    if (!file) return;
    setFlyerNote("Getting the photo ready");
    const prepared = await prepareFlyer(file);
    if (prepared.error !== null) {
      setFlyerNote(prepared.error);
      return;
    }
    if (flyer) URL.revokeObjectURL(flyer.previewUrl);
    setFlyer(prepared.data);
    setFlyerNote(null);
  }

  const canSend = mode === "photo" ? Boolean(flyer || caption.trim()) : Boolean(spoken.trim());

  // `post` drafts a handed-over post directly, before its flyer and caption reach state.
  async function draftIt(post?: { flyer: FlyerImage | null; caption: string }) {
    if (!post && (!canSend || reading)) return;
    if (speech.listening) speech.stop();
    const sendMode: InputMode = post ? "photo" : mode;
    const sendFlyer = post ? post.flyer : flyer;
    const sendCaption = post ? post.caption : caption;
    const sentCaption = sendMode === "photo" ? sendCaption.trim() || NO_CAPTION : spoken.trim();
    const body =
      sendMode === "photo"
        ? { caption: sentCaption, ...(sendFlyer ? { imageBase64: sendFlyer.base64, imageMediaType: sendFlyer.mediaType } : {}) }
        : { caption: sentCaption, spoken: true };
    setReading(true);
    setResult(null);
    const run = Date.now();
    if (post) setMaking({ phase: "reading", startedAt: run });
    try {
      const response = await fetch("/api/muse/extract/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json()) as ExtractDraftsResponse;
      const all = answer.data?.events ?? [];
      const upcoming = all.filter((draft) => !(Date.parse(draft.end) <= Date.now()));
      if (post) {
        setMaking({
          phase: "done",
          tookMs: Date.now() - run,
          live: answer.source === "muse",
          draft: upcoming[0] ?? all[0] ?? null,
          fallbackReason: answer.fallbackReason ?? null,
        });
      }
      setResult({
        run,
        mode: sendMode,
        caption: sendMode === "photo" ? sendCaption.trim() : spoken.trim(),
        drafts: upcoming,
        skippedPast: all.length - upcoming.length,
        live: answer.source === "muse",
        fallbackReason: answer.fallbackReason ?? null,
        error: answer.data ? null : (answer.error ?? `Muse could not read it (HTTP ${response.status}).`),
      });
    } catch {
      if (post) setMaking(null);
      setResult({ run, mode: sendMode, caption: sentCaption, drafts: [], skippedPast: 0, live: false, fallbackReason: null, error: "No connection. Try again." });
    } finally {
      setReading(false);
    }
  }

  const draftedSaid = useRef(false);
  useEffect(() => {
    if (!said || draftedSaid.current) return;
    draftedSaid.current = true;
    void draftIt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said]);

  // A handed-over post: load its flyer like a picked photo, then draft it at once.
  const handedOver = useRef(false);
  useEffect(() => {
    if (!handoff || handedOver.current) return;
    handedOver.current = true;
    void (async () => {
      let prepared: FlyerImage | null = null;
      try {
        const response = await fetch(handoff.flyerSrc, { cache: "no-store" });
        const blob = await response.blob();
        const file = new File([blob], "flyer.png", { type: blob.type || "image/png" });
        const ready = await prepareFlyer(file);
        if (ready.error === null) prepared = ready.data;
      } catch {
        // No flyer: Muse still reads the caption.
      }
      if (prepared) setFlyer(prepared);
      setCaption(handoff.caption);
      await draftIt({ flyer: prepared, caption: handoff.caption });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  function startOver() {
    setResult(null);
    setCaption("");
    setSpoken("");
    if (flyer) URL.revokeObjectURL(flyer.previewUrl);
    setFlyer(null);
  }

  return (
    <div className="flex flex-col gap-[12px] px-[12px] pt-[12px]">
      {handoff && (
        <p className="text-venue text-muted">
          From your Instagram post as <span className="font-display font-bold text-ink">{handoff.organizer.name}</span> (@{handoff.organizer.handle})
        </p>
      )}
      {handoff && making && <MuseMaking flyerSrc={flyer?.previewUrl ?? handoff.flyerSrc} state={making} />}
      <section className="flex flex-col gap-[10px]" hidden={Boolean(handoff)}>
        <label className="block text-venue text-muted">
          Posting as
          <select
            className={`${fieldClass} mt-[3px] font-display font-bold`}
            value={organizer.handle}
            onChange={(change) => setOrganizerHandle(change.target.value)}
          >
            {(organizers.length ? organizers : [fallbackOrganizer]).map((option) => (
              <option key={option.handle} value={option.handle}>
                {option.name} (@{option.handle})
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="How to make the event" className="flex gap-[7.6px]">
          <FilterChip active={mode === "photo"} onSelect={() => setMode("photo")}>
            Flyer photo
          </FilterChip>
          <FilterChip active={mode === "voice"} onSelect={() => setMode("voice")}>
            Say it
          </FilterChip>
        </div>

        {mode === "photo" ? (
          <>
            {flyer ? (
              <figure className="relative overflow-hidden rounded-card border border-hairline bg-wash">
                {/* A local blob URL from the organizer's own photo; next/image does not apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flyer.previewUrl} alt="The flyer you picked" className="mx-auto max-h-[300px] w-auto" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(flyer.previewUrl);
                    setFlyer(null);
                  }}
                  className="absolute top-[8px] right-[8px] rounded-full bg-card/90 px-[10px] py-[4px] font-display text-[12px] font-bold text-ink shadow-sm"
                >
                  Remove
                </button>
              </figure>
            ) : (
              <label className="flex h-[96px] cursor-pointer flex-col items-center justify-center gap-[6px] rounded-card border border-dashed border-divider bg-wash text-ink">
                <PhotoIcon className="h-[24px] w-[24px] text-primary" />
                <span className="font-display text-label font-bold">Choose a flyer photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(change) => {
                    void pickFlyer(change.target.files?.[0]);
                    change.target.value = "";
                  }}
                />
              </label>
            )}
            {flyerNote && <p className="text-venue text-muted">{flyerNote}</p>}
            <label className="block text-venue text-muted">
              Caption from the post
              <textarea
                rows={4}
                className={`${fieldClass} mt-[3px] resize-y`}
                placeholder="Paste the Instagram caption, if there is one"
                value={caption}
                onChange={(change) => setCaption(change.target.value)}
              />
            </label>
            {!caption && !flyer && (
              <button type="button" onClick={() => setCaption(sampleCaption)} className="self-start text-venue font-semibold text-link underline">
                Use a sample post
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-[10px]">
              <Button
                tone={speech.listening ? "primary" : "soft"}
                disabled={!speech.supported}
                onClick={() => (speech.listening ? speech.stop() : speech.start(spoken))}
                aria-pressed={speech.listening}
              >
                {speech.listening ? "Stop" : "Tap to talk"}
              </Button>
              <span className="text-venue text-muted" aria-live="polite">
                {speech.listening
                  ? "Listening. Say what, where, and until when."
                  : speech.supported
                    ? "Or type it below."
                    : "Voice needs Chrome or Safari here. Type it instead."}
              </span>
            </div>
            {speech.error && <p className="text-venue text-ink">{speech.error}</p>}
            <label className="block text-venue text-muted">
              What you said
              <textarea
                rows={3}
                className={`${fieldClass} mt-[3px] resize-y`}
                placeholder="Leftover pizza in the Stata lobby until 3, come grab it"
                value={spoken}
                onChange={(change) => setSpoken(change.target.value)}
              />
            </label>
          </>
        )}

        <Button tone="primary" disabled={!canSend || reading} onClick={() => void draftIt()}>
          {reading ? "Muse is reading it" : "Draft it with Muse"}
        </Button>
      </section>

      {reading && !handoff && (
        <div aria-hidden className="h-[180px] animate-pulse rounded-card border border-hairline bg-wash motion-reduce:animate-none" />
      )}

      {result && (
        <section aria-live="polite" className="flex flex-col gap-[10px] pb-[8px]">
          <div className="flex flex-wrap items-baseline justify-between gap-[6px]" hidden={Boolean(handoff) && !result.error}>
            <h2 className="font-display text-title font-bold">
              {result.error
                ? "Muse could not read it"
                : result.drafts.length === 0
                  ? result.skippedPast > 0
                    ? "Every date in this post has passed"
                    : "No event found in this post"
                  : result.drafts.length === 1
                    ? "Muse drafted 1 event"
                    : `Muse drafted ${result.drafts.length} events`}
            </h2>
            {!result.error && <SourceBadge source={result.live ? "muse" : "fixture"} />}
          </div>
          {result.error && <p className="text-body text-ink">{result.error}</p>}
          {result.skippedPast > 0 && (
            <p className="text-venue text-muted">
              Skipped {result.skippedPast === 1 ? "1 session that already happened" : `${result.skippedPast} sessions that already happened`}.
            </p>
          )}
          {!result.error && result.drafts.length === 0 && result.skippedPast === 0 && (
            <p className="text-body text-muted">Muse reads this as something other than an event people go to, like a sale or a reminder. Nothing was drafted.</p>
          )}
          {!handoff && !result.live && !result.error && result.drafts.length > 0 && (
            <p className="text-venue text-muted">Muse was not reachable, so this is a recorded example draft{result.fallbackReason ? ` (${result.fallbackReason})` : ""}.</p>
          )}
          {result.drafts.map((draft, index) => (
            <DraftCard
              key={`${result.run}-${index}`}
              draft={draft}
              index={index}
              total={result.drafts.length}
              places={places}
              organizer={organizer}
              mode={result.mode}
              caption={result.caption}
              eventTitles={eventTitles}
              live={result.live}
            />
          ))}
          <Button tone="secondary" onClick={startOver}>
            Start over
          </Button>
        </section>
      )}
    </div>
  );
}
