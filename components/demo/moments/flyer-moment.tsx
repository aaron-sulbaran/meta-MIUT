"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/demo/moments/brand-mark";
import { FLYER_SIZE, readFields, type FlyerRegion, type ReadField } from "@/components/demo/moments/flyer-regions";
import { PostedEvent } from "@/components/demo/moments/posted-event";
import type { MakingState } from "@/components/organizer/muse-making";
import { publishDraft, type Published } from "@/components/organizer/publish-draft";
import type { ExtractDraft, OrganizerOption } from "@/components/organizer/types";
import { MetaAiMark } from "@/components/ui/meta-ai-mark";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { KnownPlace } from "@/lib/organizer/place";

// O3 and O5 of the demo: "Muse is making your Facebook event". The flyer is the
// stage. While the real extract call runs, a calm band moves over the flyer;
// when the answer lands, each field Muse returned is boxed where its words are
// printed and fills in on the draft, one after another, numbered so box and
// field tie together. A guess is flagged. One tap posts it, and the screen
// becomes the posted Facebook event. Nothing here is timed to look busy: the
// working state lasts exactly as long as the call.

// The shortest the reading plays (dress rehearsal median of a live read: 2.3 s).
const MIN_READING_MS = 2500;
const REVEAL_MS = 620;
const GUESS = "#c27c00";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function campusDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CAMPUS_TIME_ZONE });
}

function formatWhen(now: Date) {
  return (draft: ExtractDraft) => {
    const start = new Date(draft.start);
    const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
    const tomorrow = new Date(now.getTime() + 86_400_000);
    const day =
      campusDay(start) === campusDay(now)
        ? "Today"
        : campusDay(start) === campusDay(tomorrow)
          ? "Tomorrow"
          : start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: CAMPUS_TIME_ZONE });
    return `${day}, ${clock(draft.start)} to ${clock(draft.end)}`;
  };
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{((now - startedAt) / 1000).toFixed(1)} s</span>;
}

function Badge({ number, guessed, on }: { number: number; guessed: boolean; on: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold transition-colors duration-300"
      style={on ? { background: guessed ? GUESS : "#0866ff", color: "#fff" } : { background: "#e4e6eb", color: "#65676b" }}
    >
      {number}
    </span>
  );
}

function FlyerBoxes({ fields, shown, active }: { fields: ReadField[]; shown: number; active: number }) {
  return (
    <svg viewBox={`0 0 ${FLYER_SIZE.width} ${FLYER_SIZE.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {fields.map((field, index) => {
        if (index >= shown || field.source.kind !== "flyer") return null;
        const { x, y, width, height } = field.source.region;
        const color = field.guessed ? GUESS : "#0866ff";
        const isActive = index === active;
        return (
          <g key={field.id} className="moment-box">
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={22}
              pathLength={1}
              fill={color}
              fillOpacity={isActive ? 0.16 : 0.07}
              stroke={color}
              strokeWidth={isActive ? 9 : 6}
              strokeDasharray={field.guessed ? "0.025 0.015" : "1"}
              className="moment-draw"
              style={{ transition: "fill-opacity 300ms ease, stroke-width 300ms ease" }}
            />
            <g className="moment-pop" style={{ transformOrigin: `${x}px ${y}px` }}>
              <circle cx={x} cy={y} r={38} fill={color} stroke="#fff" strokeWidth={7} />
              <text x={x} y={y + 15} textAnchor="middle" fontSize={44} fontWeight={800} fill="#fff" fontFamily="var(--font-display), system-ui">
                {index + 1}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function FlyerMoment({
  flyerSrc,
  caption,
  regions,
  now,
  state: given,
  places,
  organizer,
  onEdit,
  onPosted,
}: {
  flyerSrc: string;
  caption: string;
  /** Where each line is printed on this flyer (the drawn demo flyer); empty for a flyer with no known layout, so nothing is boxed. */
  regions: FlyerRegion[];
  now: Date;
  state: MakingState;
  places: KnownPlace[];
  organizer: OrganizerOption;
  onEdit: () => void;
  onPosted?: (published: Published) => void;
}) {
  // An answer the stage started early can land at once: Muse's reading still plays for a
  // moment, never longer than the real call took, so the clock never runs past it.
  const [readingSince] = useState(() => (given.phase === "reading" ? given.startedAt : null));
  const [released, setReleased] = useState<MakingState | null>(null);
  useEffect(() => {
    if (given.phase !== "done" || readingSince === null) return;
    const hold = Math.min(MIN_READING_MS, given.live ? given.tookMs : MIN_READING_MS);
    const timer = setTimeout(() => setReleased(given), Math.max(0, hold - (Date.now() - readingSince)));
    return () => clearTimeout(timer);
  }, [given, readingSince]);
  const state: MakingState = given.phase === "done" && readingSince !== null && released !== given ? { phase: "reading", startedAt: readingSince } : given;
  const draft = state.phase === "done" ? state.draft : null;
  const fields = useMemo(() => (draft ? readFields(draft, regions, formatWhen(now)) : null), [draft, regions, now]);
  const [shown, setShown] = useState(0);
  const [posting, setPosting] = useState<"idle" | "saving" | { error: string }>("idle");
  const [published, setPublished] = useState<Published | null>(null);
  const actions = useRef<HTMLDivElement>(null);

  // Play the fields in from the real answer, one after another.
  useEffect(() => {
    if (!fields) return;
    const instant = prefersReducedMotion();
    let next = 0;
    const tick = () => {
      next = instant ? fields.length : next + 1;
      setShown(next);
      if (next < fields.length) timer = setTimeout(tick, REVEAL_MS);
    };
    let timer = setTimeout(tick, instant ? 0 : 180);
    return () => clearTimeout(timer);
  }, [fields]);

  const allShown = fields !== null && shown >= fields.length;
  // Bring the Post button into view once every field is in, gliding, not jumping.
  useEffect(() => {
    if (!allShown) return;
    actions.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
  }, [allShown]);

  async function post() {
    if (!draft || posting === "saving") return;
    setPosting("saving");
    const result = await publishDraft(draft, { places, organizer, caption });
    if (result.error !== null) return setPosting({ error: result.error });
    setPublished(result.data);
    onPosted?.(result.data);
  }

  if (published) return <PostedEvent event={published.event} alert={published.alert} flyerSrc={flyerSrc} now={now} />;

  const reading = state.phase === "reading";
  const live = state.phase === "done" && state.live;
  const labels = ["What it is", "When", "Where", "Free food", "Who can come"];

  return (
    <section aria-live="polite" aria-busy={reading} className="moment-enter flex flex-col gap-[12px]">
      <style>{MOMENT_CSS}</style>
      <div className="flex items-center gap-[10px]">
        <span className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-primary-soft`}>
          <MetaAiMark size={24} working={reading} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-title font-bold leading-[20px]">{reading ? "Muse is making your Facebook event" : "Muse made your Facebook event"}</h2>
          <p className="flex items-center gap-[5px] text-meta font-semibold text-muted">
            <BrandMark name="instagram" className="h-[13px] w-[13px]" decorative />
            {reading ? (
              <span>
                Reading your Instagram post · <Elapsed startedAt={state.startedAt} />
              </span>
            ) : state.phase === "done" && state.draft ? (
              <span>
                {live ? `Read in ${(state.tookMs / 1000).toFixed(1)} s` : "Recorded example"}
              </span>
            ) : (
              <span>Muse found no event in this post</span>
            )}
          </p>
        </div>
      </div>

      <div className="relative mx-auto w-[272px] overflow-hidden rounded-[10px] border border-hairline bg-wash" style={regions.length > 0 ? { aspectRatio: `${FLYER_SIZE.width} / ${FLYER_SIZE.height}` } : undefined}>
        {/* The organizer's own post image (a drawn flyer in the demo). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flyerSrc} alt="Your Instagram post's flyer" className={regions.length > 0 ? "h-full w-full object-cover" : "block h-auto w-full"} />
        {reading && <span aria-hidden className="moment-scan absolute inset-x-0 h-[22%] motion-reduce:hidden" />}
        {fields && <FlyerBoxes fields={fields} shown={shown} active={allShown ? -1 : shown - 1} />}
      </div>

      <ol className="flex flex-col rounded-card border border-hairline bg-card">
        {labels.map((label, index) => {
          const field = fields?.[index] ?? null;
          const on = field !== null && index < shown;
          return (
            <li key={label} className="flex items-start gap-[10px] border-t border-hairline px-[12px] py-[7px] first:border-t-0">
              <Badge number={index + 1} guessed={Boolean(field?.guessed)} on={on} />
              <div className="min-w-0 flex-1">
                <p className="text-meta font-semibold text-muted">{label}</p>
                {on && field ? (
                  <div className="moment-fill">
                    <p className="truncate font-display text-label font-bold">{field.value}</p>
                    {field.guessed ? (
                      <p className="text-meta font-semibold" style={{ color: GUESS }}>
                        Muse guessed this. Check it.
                      </p>
                    ) : field.source.kind === "caption" ? (
                      <p className="truncate text-meta text-muted">From your caption: &ldquo;{field.source.quote}&rdquo;</p>
                    ) : null}
                  </div>
                ) : (
                  <span aria-hidden className={`mt-[4px] block h-[12px] rounded-full bg-wash ${reading ? "moment-wait" : ""}`} style={{ width: `${48 + ((index * 23) % 40)}%`, animationDelay: `${index * 160}ms` }} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {allShown && draft && (
        <div ref={actions} className="moment-fill flex scroll-mb-[150px] flex-col gap-[6px]">
          <button
            type="button"
            onClick={post}
            disabled={posting === "saving"}
            className="flex h-[44px] items-center justify-center gap-[8px] rounded-button bg-primary font-display text-label font-bold text-on-primary disabled:opacity-70"
          >
            {posting === "saving" ? "Posting" : "Post to Facebook Events"}
          </button>
          <button type="button" onClick={onEdit} className="h-[32px] font-display text-label font-bold text-link">
            Edit details
          </button>
          {typeof posting === "object" && (
            <p role="alert" className="text-venue text-ink">
              {posting.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const MOMENT_CSS = `
@keyframes moment-scan { 0% { top: -22%; } 100% { top: 100%; } }
@keyframes moment-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes moment-wait { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes moment-draw { from { stroke-dashoffset: 1; fill-opacity: 0; } to { stroke-dashoffset: 0; } }
@keyframes moment-pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
@keyframes moment-fill { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.moment-scan { background: linear-gradient(to bottom, transparent, rgba(8,102,255,.28) 55%, rgba(8,102,255,.42) 60%, transparent); animation: moment-scan 1.8s cubic-bezier(.45,0,.55,1) infinite; }
.moment-breathe { animation: moment-breathe 1.4s ease-in-out infinite; }
.moment-wait { animation: moment-wait 1.3s ease-in-out infinite; }
.moment-draw { stroke-dashoffset: 0; animation: moment-draw 480ms cubic-bezier(.3,.7,.3,1) both; }
.moment-pop { animation: moment-pop 380ms cubic-bezier(.3,.7,.3,1.2) 140ms both; transform-box: view-box; }
.moment-fill { animation: moment-fill 320ms cubic-bezier(.3,.7,.3,1) both; }
.moment-enter { animation: moment-fill 280ms ease both; }
@media (prefers-reduced-motion: reduce) {
  .moment-scan, .moment-breathe, .moment-wait, .moment-draw, .moment-pop, .moment-fill, .moment-enter { animation: none; }
}
`;
