"use client";

import { useState } from "react";
import { Card, SourceBadge } from "@/components/ui/card";
import { CAMPUS_TIME_ZONE } from "@/lib/brand";
import type { MuseRouteResponse } from "@/lib/muse/types";

type Draft = {
  title: string;
  description: string;
  start: string;
  end: string;
  placeName: string;
  free: boolean;
  food: boolean;
  foodNote?: string;
  access: { kind: "open" | "rsvp"; capacity?: number };
  confidence: Record<string, number | undefined>;
};

function ConfidenceTag({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  const low = value < 0.75;
  return (
    <span className={`ml-2 text-[11px] font-semibold ${low ? "text-[#e41e3f]" : "text-muted"}`}>
      {Math.round(value * 100)}%{low ? ", check this" : ""}
    </span>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function ExtractDemo({ sampleCaption }: { sampleCaption: string }) {
  const [caption, setCaption] = useState(sampleCaption);
  const [result, setResult] = useState<MuseRouteResponse<Draft> | null>(null);
  const [loading, setLoading] = useState(false);

  async function runExtract() {
    setLoading(true);
    try {
      const response = await fetch("/api/muse/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      setResult((await response.json()) as MuseRouteResponse<Draft>);
    } catch {
      setResult({ data: null, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const draft = result?.data ?? null;

  return (
    <div className="flex flex-col gap-3">
      <Card className="mx-3 mt-3">
        <p className="text-[13px] font-semibold text-muted">Instagram post (sample flyer caption)</p>
        <textarea
          value={caption}
          onChange={(change) => setCaption(change.target.value)}
          rows={5}
          className="mt-2 w-full rounded-md border border-divider p-2 text-[15px]"
        />
        <button
          type="button"
          onClick={runExtract}
          disabled={loading || caption.trim().length === 0}
          className="mt-2 w-full rounded-md bg-primary py-2 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Reading the post..." : "Draft a Facebook event"}
        </button>
      </Card>

      {result?.error && !draft && (
        <Card className="mx-3">
          <p className="text-[14px] text-[#e41e3f]">{result.error}</p>
        </Card>
      )}

      {draft && (
        <Card className="mx-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold">Draft event</h2>
            {result?.source && <SourceBadge source={result.source} />}
          </div>
          {result?.fallbackReason && <p className="mt-1 text-[12px] text-muted">Fallback: {result.fallbackReason}</p>}
          <dl className="mt-3 flex flex-col gap-2 text-[15px]">
            <div>
              <dt className="text-[12px] text-muted">Title<ConfidenceTag value={draft.confidence.title} /></dt>
              <dd className="font-semibold">{draft.title}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">When<ConfidenceTag value={draft.confidence.start} /></dt>
              <dd>{formatWhen(draft.start)} to {formatWhen(draft.end)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Where<ConfidenceTag value={draft.confidence.place} /></dt>
              <dd>{draft.placeName}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Free and food<ConfidenceTag value={draft.confidence.free} /></dt>
              <dd>{draft.free ? "Free" : "Paid"}{draft.food ? `, food: ${draft.foodNote ?? "yes"}` : ""}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Access<ConfidenceTag value={draft.confidence.access} /></dt>
              <dd>{draft.access.kind === "rsvp" ? `RSVP, ${draft.access.capacity ?? "?"} spots` : "Open to all"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-muted">Confirm and publish comes next (organizer lane).</p>
        </Card>
      )}
    </div>
  );
}
