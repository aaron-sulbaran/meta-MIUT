"use client";

import { useCallback, useState } from "react";
import { DraftCard } from "@/components/organizer/draft-card";
import { prepareFlyer } from "@/components/organizer/flyer-image";
import type { ExtractDraft, ExtractDraftsResponse, FlyerImage, InputMode, OrganizerOption } from "@/components/organizer/types";
import { useSpeechInput } from "@/components/organizer/use-speech-input";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ui/card";
import { FilterChip } from "@/components/ui/chips";
import { PhotoIcon } from "@/components/ui/icons";
import type { KnownPlace } from "@/lib/organizer/place";

// The organizer side of the demo: a flyer photo (with its caption) or a spoken line in,
// Muse drafts every event in it, the organizer checks the flagged fields and publishes.

const NO_CAPTION = "(No caption. Read everything from the flyer image.)";

type Result = {
  run: number;
  mode: InputMode;
  caption: string;
  drafts: ExtractDraft[];
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
}: {
  places: KnownPlace[];
  organizers: OrganizerOption[];
  eventTitles: Record<string, string>;
  sampleCaption: string;
}) {
  const fallbackOrganizer: OrganizerOption = { name: "Your club", handle: "your_club" };
  const [organizerHandle, setOrganizerHandle] = useState(organizers[0]?.handle ?? fallbackOrganizer.handle);
  const organizer = organizers.find((option) => option.handle === organizerHandle) ?? organizers[0] ?? fallbackOrganizer;

  const [mode, setMode] = useState<InputMode>("photo");
  const [flyer, setFlyer] = useState<FlyerImage | null>(null);
  const [flyerNote, setFlyerNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [spoken, setSpoken] = useState("");
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

  async function draftIt() {
    if (!canSend || reading) return;
    if (speech.listening) speech.stop();
    const sentCaption = mode === "photo" ? caption.trim() || NO_CAPTION : spoken.trim();
    const body =
      mode === "photo"
        ? { caption: sentCaption, ...(flyer ? { imageBase64: flyer.base64, imageMediaType: flyer.mediaType } : {}) }
        : { caption: sentCaption, spoken: true };
    setReading(true);
    setResult(null);
    const run = Date.now();
    try {
      const response = await fetch("/api/muse/extract/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json()) as ExtractDraftsResponse;
      setResult({
        run,
        mode,
        caption: mode === "photo" ? caption.trim() : spoken.trim(),
        drafts: answer.data?.events ?? [],
        live: answer.source === "muse",
        fallbackReason: answer.fallbackReason ?? null,
        error: answer.data ? null : (answer.error ?? `Muse could not read it (HTTP ${response.status}).`),
      });
    } catch {
      setResult({ run, mode, caption: sentCaption, drafts: [], live: false, fallbackReason: null, error: "No connection. Try again." });
    } finally {
      setReading(false);
    }
  }

  function startOver() {
    setResult(null);
    setCaption("");
    setSpoken("");
    if (flyer) URL.revokeObjectURL(flyer.previewUrl);
    setFlyer(null);
  }

  return (
    <div className="flex flex-col gap-[12px] px-[12px] pt-[12px]">
      <section className="flex flex-col gap-[10px]">
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

        <Button tone="primary" disabled={!canSend || reading} onClick={draftIt}>
          {reading ? "Muse is reading it" : "Draft it with Muse"}
        </Button>
      </section>

      {reading && (
        <div aria-hidden className="h-[180px] animate-pulse rounded-card border border-hairline bg-wash motion-reduce:animate-none" />
      )}

      {result && (
        <section aria-live="polite" className="flex flex-col gap-[10px] pb-[8px]">
          <div className="flex flex-wrap items-baseline justify-between gap-[6px]">
            <h2 className="font-display text-title font-bold">
              {result.error
                ? "Muse could not read it"
                : result.drafts.length === 0
                  ? "No event found in this post"
                  : result.drafts.length === 1
                    ? "Muse drafted 1 event"
                    : `Muse drafted ${result.drafts.length} events`}
            </h2>
            {!result.error && <SourceBadge source={result.live ? "muse" : "fixture"} />}
          </div>
          {result.error && <p className="text-body text-ink">{result.error}</p>}
          {!result.error && result.drafts.length === 0 && (
            <p className="text-body text-muted">Muse reads this as something other than an event people go to, like a sale or a reminder. Nothing was drafted.</p>
          )}
          {!result.live && !result.error && result.drafts.length > 0 && (
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
