"use client";

import { useEffect, useRef, useState } from "react";
import { DraftCard } from "@/components/organizer/draft-card";
import { prepareFlyer } from "@/components/organizer/flyer-image";
import { FlyerMoment } from "@/components/demo/moments/flyer-moment";
import type { MakingState } from "@/components/organizer/muse-making";
import type { ExtractDraft, ExtractDraftsResponse, FlyerImage, InputMode, OrganizerOption } from "@/components/organizer/types";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ui/card";
import { handOff } from "@/lib/demo/staged";
import type { KnownPlace } from "@/lib/organizer/place";

// The organizer side of the demo: a flyer photo (with its caption) or a spoken line in,
// Muse drafts every event in it, the organizer checks the flagged fields and publishes.
// A handoff (the demo's staged Instagram post, ?handoff=story) brings its own flyer and
// caption: no picker, Muse starts at once behind the "making your event" card (O3).

/** A post handed over from the staged Instagram screen: its flyer, caption, and club. */
export type OrganizerHandoff = {
  flyerSrc: string;
  caption: string;
  organizer: OrganizerOption;
  // The flyer's printed time line and the demo clock, so boxes land on the right words.
  timeLine: string;
  nowIso: string;
  // Where the stage goes once the event is posted (O5), or null outside the stage.
  postedPath: string | null;
};

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
  said = "",
  handoff = null,
}: {
  places: KnownPlace[];
  organizers: OrganizerOption[];
  eventTitles: Record<string, string>;
  // A spoken line from Ask Muse, drafted as soon as the screen opens.
  said?: string;
  handoff?: OrganizerHandoff | null;
}) {
  const fallbackOrganizer: OrganizerOption = { name: "Your club", handle: "your_club" };
  // The club the organizer is signed in as on Instagram; no picking other clubs.
  const organizer = handoff?.organizer ?? organizers[0] ?? fallbackOrganizer;

  // Manual inputs are gone: a draft comes from a handed-over post or a line said to Ask Muse.
  const mode: InputMode = said ? "voice" : "photo";
  const [flyer, setFlyer] = useState<FlyerImage | null>(null);
  const [caption, setCaption] = useState("");
  const [spoken, setSpoken] = useState(said);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [making, setMaking] = useState<MakingState | null>(null);
  // In the handoff moment the draft form stays folded until the organizer asks to edit.
  const [editing, setEditing] = useState(false);

  const canSend = mode === "photo" ? Boolean(flyer || caption.trim()) : Boolean(spoken.trim());

  // `post` drafts a handed-over post directly, before its flyer and caption reach state.
  async function draftIt(post?: { flyer: FlyerImage | null; caption: string }) {
    if (!post && (!canSend || reading)) return;
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
      {handoff && making && !editing && (
        <FlyerMoment
          flyerSrc={flyer?.previewUrl ?? handoff.flyerSrc}
          caption={handoff.caption}
          timeLine={handoff.timeLine}
          now={new Date(handoff.nowIso)}
          state={making}
          places={places}
          organizer={organizer}
          onEdit={() => setEditing(true)}
          onPosted={() => {
            // Tell the /demo stage the post happened, so it moves on to O5 without a reload.
            if (handoff.postedPath && typeof window !== "undefined" && window.parent !== window) handOff(handoff.postedPath, () => {});
          }}
        />
      )}
      <section className="flex flex-col gap-[10px]" hidden={Boolean(handoff)}>
        <div className="text-venue text-muted">
          Posting as
          <p className={`${fieldClass} mt-[3px] bg-wash font-display font-bold`}>
            {organizer.name} <span className="font-sans font-semibold text-muted">@{organizer.handle}</span>
          </p>
          <p className="mt-[3px] text-meta text-muted">The club you are signed in as on Instagram.</p>
        </div>

        <p className="text-body text-muted">
          Post your flyer on Instagram, or tell Ask Muse about the event, and Muse drafts it here for you to check and publish.
        </p>
      </section>

      {reading && !handoff && (
        <div aria-hidden className="h-[180px] animate-pulse rounded-card border border-hairline bg-wash motion-reduce:animate-none" />
      )}

      {result && (
        <section aria-live="polite" className="flex flex-col gap-[10px] pb-[8px]" hidden={Boolean(handoff) && !editing && !result.error}>
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
