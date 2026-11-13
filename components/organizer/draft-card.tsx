"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import type {
  DraftEvidence,
  DraftEvidenceField,
  DraftUpdates,
  ExtractDraft,
  InputMode,
  MatchResponse,
  OrganizerOption,
} from "@/components/organizer/types";
import type { Alert } from "@/lib/alerts/schema";
import type { CampusEvent } from "@/lib/events/schema";
import { fromCampusWallTime, toCampusWallTime } from "@/lib/organizer/campus-time";
import { tidyFoodNote } from "@/lib/organizer/food-note";
import { campusCenter, resolvePlace, type KnownPlace } from "@/lib/organizer/place";

// One drafted event: every field Muse filled, the words it read them from, a flag on
// the ones it guessed, all editable, then one tap to publish (or to update the
// listing this post repeats).

const CHECK_BELOW = 0.75;
const CAMPUS_PIN = "__campus__";

type PublishState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "published"; event: CampusEvent; alert: Alert | null; updated: boolean }
  | { kind: "error"; message: string };

type Fields = {
  title: string;
  description: string;
  startWall: string;
  endWall: string;
  placeName: string;
  placeChoice: string;
  free: boolean;
  food: boolean;
  foodNote: string;
  accessKind: "open" | "rsvp";
  capacity: string;
};

function initialFields(draft: ExtractDraft): Fields {
  return {
    title: draft.title,
    description: draft.description,
    startWall: toCampusWallTime(draft.start),
    endWall: toCampusWallTime(draft.end),
    placeName: draft.placeName,
    placeChoice: "",
    free: draft.free,
    food: draft.food,
    foodNote: tidyFoodNote(draft.foodNote),
    accessKind: draft.access.kind,
    capacity: draft.access.capacity ? String(draft.access.capacity) : "",
  };
}

function needsCheck(draft: ExtractDraft, ...fields: string[]): boolean {
  return fields.some((field) => {
    const score = draft.confidence[field];
    return score !== undefined && score < CHECK_BELOW;
  });
}

function EvidenceLine({ evidence, guessNote }: { evidence: DraftEvidence | undefined; guessNote?: string }) {
  if (evidence && evidence.from !== "inferred" && evidence.quote.trim()) {
    return (
      <p className="mt-[5px] text-venue text-muted">
        <span className="font-semibold">{evidence.from === "image" ? "From the flyer" : "From the post"}:</span>{" "}
        <q className="text-ink">{evidence.quote.trim()}</q>
      </p>
    );
  }
  return <p className="mt-[5px] text-venue text-muted">{guessNote ?? "Muse guessed this; nothing in the post says it outright."}</p>;
}

function Row({
  number,
  label,
  check,
  children,
}: {
  number: number;
  label: string;
  check: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-[10px] border-t border-hairline py-[12px] first:border-t-0">
      <span
        aria-hidden
        className="mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-[12px] font-bold text-link"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
          <span className="font-display text-label font-bold">{label}</span>
          {check && (
            <span className="inline-flex items-center gap-[5px] rounded-full bg-primary-soft px-[8px] py-[2px] font-display text-meta font-bold text-link">
              <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-primary" />
              Check this
            </span>
          )}
        </div>
        <div className="mt-[6px]">{children}</div>
      </div>
    </li>
  );
}

const inputClass =
  "w-full min-w-0 rounded-[8px] border border-divider bg-card px-[10px] py-[8px] text-body text-ink focus-visible:outline-2 focus-visible:outline-primary";

function Toggle({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-[6px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-[32px] rounded-full px-[12px] font-display text-[13px] font-bold ${
            value === option.value ? "bg-primary-soft text-link" : "bg-button text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

async function readBody<T>(response: Response): Promise<{ data: T | null; error: string | null }> {
  try {
    return (await response.json()) as { data: T | null; error: string | null };
  } catch {
    return { data: null, error: `The server answered HTTP ${response.status}` };
  }
}

export function DraftCard({
  draft,
  index,
  total,
  places,
  organizer,
  mode,
  caption,
  eventTitles,
  live,
}: {
  draft: ExtractDraft;
  index: number;
  total: number;
  places: KnownPlace[];
  organizer: OrganizerOption;
  mode: InputMode;
  caption: string;
  eventTitles: Record<string, string>;
  live: boolean;
}) {
  const [fields, setFields] = useState<Fields>(() => initialFields(draft));
  const [publish, setPublish] = useState<PublishState>({ kind: "idle" });
  const [repost, setRepost] = useState<{ eventId: string; reason: string; updates: DraftUpdates } | null>(null);
  const [asNew, setAsNew] = useState(false);
  const [leftover, setLeftover] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((current) => ({ ...current, [key]: value }));

  // A live answer only: the recorded stand-in never claims a repost.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    fetch("/api/muse/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft, organizerHandle: organizer.handle }),
    })
      .then((response) => response.json() as Promise<MatchResponse>)
      .then((body) => {
        if (cancelled || body.source !== "muse" || !body.data?.eventId) return;
        setRepost({ eventId: body.data.eventId, reason: body.data.reason, updates: body.data.updates });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft, organizer.handle, live]);

  const placeMatch = useMemo(() => resolvePlace(fields.placeName, places), [fields.placeName, places]);
  const center = useMemo(() => campusCenter(places), [places]);

  function chosenPlace(): { name: string; lat: number; lng: number } | null {
    const name = fields.placeName.trim();
    if (!name) return null;
    if (fields.placeChoice === CAMPUS_PIN) return center ? { name, ...center } : null;
    if (fields.placeChoice) {
      const [lat, lng] = fields.placeChoice.split(",").map(Number);
      if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) return { name, lat, lng };
    }
    return placeMatch ? { name, lat: placeMatch.place.lat, lng: placeMatch.place.lng } : null;
  }

  function problems(): string[] {
    const found: string[] = [];
    const start = fromCampusWallTime(fields.startWall);
    const end = fromCampusWallTime(fields.endWall);
    if (!fields.title.trim()) found.push("Add a title.");
    if (!start || !end) found.push("Set when it starts and ends.");
    else if (Date.parse(end) <= Date.parse(start)) found.push("The end has to be after the start.");
    if (!chosenPlace()) found.push("Pick where it is on the map.");
    if (fields.accessKind === "rsvp" && fields.capacity && !(Number(fields.capacity) > 0)) found.push("Seats should be a number.");
    return found;
  }

  async function publishNew() {
    const place = chosenPlace();
    const start = fromCampusWallTime(fields.startWall);
    const end = fromCampusWallTime(fields.endWall);
    if (!place || !start || !end) return;
    setPublish({ kind: "saving" });
    const capacity = Math.round(Number(fields.capacity));
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: fields.title.trim(),
        description: fields.description.trim(),
        start,
        end,
        place,
        free: fields.free,
        food: fields.food,
        ...(fields.food && fields.foodNote.trim() ? { foodNote: fields.foodNote.trim() } : {}),
        access: fields.accessKind === "rsvp" ? { kind: "rsvp", ...(capacity > 0 ? { capacity } : {}) } : { kind: "open" },
        organizer: { name: organizer.name, handle: organizer.handle },
        source: { kind: mode === "photo" ? "instagram" : "manual", caption: caption.trim() || undefined },
        confidence: draft.confidence,
      }),
    }).catch(() => null);
    if (!response) return setPublish({ kind: "error", message: "No connection. Try again." });
    const body = await readBody<{ event: CampusEvent; alert: Alert | null }>(response);
    if (body.error !== null || !body.data) return setPublish({ kind: "error", message: body.error ?? "Could not publish. Try again." });
    setPublish({ kind: "published", event: body.data.event, alert: body.data.alert, updated: false });
  }

  async function updateListing(eventId: string, updates: DraftUpdates) {
    setPublish({ kind: "saving" });
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates }),
    }).catch(() => null);
    if (!response) return setPublish({ kind: "error", message: "No connection. Try again." });
    const body = await readBody<CampusEvent>(response);
    if (body.error !== null || !body.data) return setPublish({ kind: "error", message: body.error ?? "Could not update. Try again." });
    setPublish({ kind: "published", event: body.data, alert: null, updated: true });
  }

  async function pushLeftovers(eventId: string) {
    setLeftover("sending");
    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, kind: "leftover_food" }),
    }).catch(() => null);
    setLeftover(response?.ok ? "sent" : "error");
  }

  const heading = total > 1 ? `Event ${index + 1} of ${total}` : "Draft event";

  if (publish.kind === "published") {
    const { event, alert, updated } = publish;
    return (
      <section aria-live="polite" className="rounded-card border border-hairline bg-card p-[14px]">
        <p className="font-display text-meta font-bold tracking-[0.04em] text-muted uppercase">{updated ? "Updated" : "Published"}</p>
        <h2 className="mt-[4px] font-display text-title font-bold">{event.title}</h2>
        <p className="mt-[6px] text-body text-muted">
          {updated
            ? "The listing now shows what this post changed. No second event was added."
            : alert
              ? "Students nearby are getting a notification now."
              : "It is on the Events tab now."}
        </p>
        {alert && (
          <p className="mt-[8px] rounded-[8px] bg-wash px-[10px] py-[8px] text-venue">
            <span className="font-semibold">{alert.title}</span>
            <br />
            {alert.body}
          </p>
        )}
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          <ButtonLink href={`/events/${encodeURIComponent(event.id)}`} tone="primary">
            See it as a student
          </ButtonLink>
          {event.food && (
            <Button tone="soft" disabled={leftover === "sending" || leftover === "sent"} onClick={() => pushLeftovers(event.id)}>
              {leftover === "sent" ? "Leftovers pushed" : leftover === "sending" ? "Pushing" : "Push leftover food"}
            </Button>
          )}
        </div>
        {leftover === "error" && <p className="mt-[6px] text-venue text-muted">Could not push the leftover alert. Try again.</p>}
      </section>
    );
  }

  const issues = problems();
  const saving = publish.kind === "saving";
  const showRepost = repost && !asNew;
  const matchedTitle = repost ? (eventTitles[repost.eventId] ?? "an event already listed") : "";
  const ev = draft.evidence as Partial<Record<DraftEvidenceField, DraftEvidence>>;
  const freeGuess = draft.free ? "No price on the post, so it is listed as free." : undefined;

  return (
    <section aria-label={heading} className="rounded-card border border-hairline bg-card px-[14px] pt-[12px] pb-[14px]">
      <p className="font-display text-meta font-bold tracking-[0.04em] text-muted uppercase">{heading}</p>

      {showRepost && (
        <div className="mt-[10px] rounded-[8px] bg-primary-soft px-[10px] py-[9px] text-body">
          <p className="font-display text-label font-bold text-link">Looks like a repost of {matchedTitle}</p>
          <p className="mt-[3px] text-ink">{repost.reason}</p>
          <button type="button" onClick={() => setAsNew(true)} className="mt-[6px] text-venue font-semibold text-link underline">
            It is a different event
          </button>
        </div>
      )}

      <ol className="mt-[4px]">
        <Row number={1} label="Title" check={needsCheck(draft, "title")}>
          <input aria-label="Title" className={inputClass} value={fields.title} onChange={(change) => set("title", change.target.value)} />
          <EvidenceLine evidence={ev.title} />
        </Row>

        <Row number={2} label="When" check={needsCheck(draft, "start", "end")}>
          <div className="grid gap-[8px]">
            <label className="min-w-0 text-venue text-muted">
              Starts
              <input
                type="datetime-local"
                className={`${inputClass} mt-[3px]`}
                value={fields.startWall}
                onChange={(change) => set("startWall", change.target.value)}
              />
            </label>
            <label className="min-w-0 text-venue text-muted">
              Ends
              <input
                type="datetime-local"
                className={`${inputClass} mt-[3px]`}
                value={fields.endWall}
                onChange={(change) => set("endWall", change.target.value)}
              />
            </label>
          </div>
          <EvidenceLine evidence={ev.start} />
          {ev.end && ev.end.quote.trim() && ev.end.quote !== ev.start?.quote && <EvidenceLine evidence={ev.end} />}
        </Row>

        <Row number={3} label="Where" check={needsCheck(draft, "place") || !chosenPlace()}>
          <input
            aria-label="Place"
            className={inputClass}
            value={fields.placeName}
            onChange={(change) => {
              set("placeName", change.target.value);
              set("placeChoice", "");
            }}
          />
          {placeMatch && !fields.placeChoice ? (
            <p className="mt-[5px] text-venue text-muted">
              On the map at {placeMatch.knownName}.{" "}
              <button
                type="button"
                onClick={() => set("placeChoice", placeMatch.place.lat + "," + placeMatch.place.lng)}
                className="font-semibold text-link underline"
              >
                Change
              </button>
            </p>
          ) : (
            <label className="mt-[6px] block text-venue text-muted">
              Where is it on the map?
              <select
                className={`${inputClass} mt-[3px]`}
                value={fields.placeChoice}
                onChange={(change) => set("placeChoice", change.target.value)}
              >
                <option value="">Pick a spot</option>
                {places.map((place) => (
                  <option key={place.name} value={place.lat + "," + place.lng}>
                    {place.name}
                  </option>
                ))}
                {center && <option value={CAMPUS_PIN}>Somewhere on campus (pin at the middle)</option>}
              </select>
            </label>
          )}
          <EvidenceLine evidence={ev.place} />
        </Row>

        <Row number={4} label="Price" check={needsCheck(draft, "free")}>
          <Toggle
            label="Price"
            value={fields.free ? "free" : "paid"}
            onChange={(value) => set("free", value === "free")}
            options={[
              { value: "free", label: "Free" },
              { value: "paid", label: "Paid entry" },
            ]}
          />
          <EvidenceLine evidence={ev.free} guessNote={freeGuess} />
        </Row>

        <Row number={5} label="Food" check={needsCheck(draft, "food")}>
          <Toggle
            label="Food"
            value={fields.food ? "yes" : "no"}
            onChange={(value) => set("food", value === "yes")}
            options={[
              { value: "yes", label: "Food" },
              { value: "no", label: "No food" },
            ]}
          />
          {fields.food && (
            <input
              aria-label="What food"
              placeholder="What food, for example pizza"
              className={`${inputClass} mt-[6px]`}
              value={fields.foodNote}
              onChange={(change) => set("foodNote", change.target.value)}
            />
          )}
          <EvidenceLine evidence={ev.food} />
        </Row>

        <Row number={6} label="Who can come" check={needsCheck(draft, "access")}>
          <Toggle
            label="Who can come"
            value={fields.accessKind}
            onChange={(value) => set("accessKind", value === "rsvp" ? "rsvp" : "open")}
            options={[
              { value: "open", label: "Open to all" },
              { value: "rsvp", label: "RSVP" },
            ]}
          />
          {fields.accessKind === "rsvp" && (
            <input
              aria-label="Seats"
              inputMode="numeric"
              placeholder="Seats, if limited"
              className={`${inputClass} mt-[6px]`}
              value={fields.capacity}
              onChange={(change) => set("capacity", change.target.value.replace(/[^0-9]/g, ""))}
            />
          )}
          <EvidenceLine evidence={ev.access} />
        </Row>
      </ol>

      {issues.length > 0 && <p className="mt-[4px] text-venue text-muted">{issues.join(" ")}</p>}
      {publish.kind === "error" && (
        <p role="alert" className="mt-[4px] text-venue text-ink">
          {publish.message}
        </p>
      )}

      <div className="mt-[10px] grid gap-[8px]">
        {showRepost ? (
          <Button tone="primary" disabled={saving} onClick={() => updateListing(repost.eventId, repost.updates)}>
            {saving ? "Updating" : "Update the listed event"}
          </Button>
        ) : (
          <Button tone="primary" disabled={saving || issues.length > 0} onClick={publishNew}>
            {saving ? "Publishing" : "Publish event"}
          </Button>
        )}
      </div>
    </section>
  );
}
