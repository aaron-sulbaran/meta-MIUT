"use client";

import { useEffect, useRef } from "react";
import { prepareFlyer } from "@/components/organizer/flyer-image";
import type { Beat, BeatContext } from "@/lib/demo/beats";
import { flyerUrl, storyCaption } from "@/lib/demo/staged";

// The stage gives the demo's three slow live Muse moments a head start: it asks each
// question a few beats before its screen does (app/api/demo/head-start), and the screen
// shares that one live call when it asks (lib/demo/head-start.ts). Once per run each:
// - the organizer's act starts: Muse reads the story flyer (shown at O3)
// - her post is live (O5): Muse plans the walk home (shown at U1b)
// Trish's first events feed has no head start: Muse reads nothing before she says yes.
// Fire and forget: a head start that fails changes nothing, the screen asks as before.

type Job = "flyer" | "walk-home";

// After O5 appears, give its screen a moment to list the story event before planning around it.
const AFTER_POST_MS = 1500;

function jobFor(beat: Beat): Job | null {
  if (beat.act === "organizer" && (beat.id === "O1" || beat.id === "O2")) return "flyer";
  if (beat.id === "O5" || beat.id === "U1a") return "walk-home";
  return null;
}

async function startJob(job: Job, now: Date): Promise<void> {
  let body: unknown;
  if (job === "flyer") {
    // The flyer exactly as the organizer screen sends it: fetched, then shrunk in this browser.
    const response = await fetch(flyerUrl(now), { cache: "no-store" });
    const blob = await response.blob();
    const ready = await prepareFlyer(new File([blob], "flyer.png", { type: blob.type || "image/png" }));
    const caption = storyCaption(now);
    body = { job, input: ready.error === null ? { caption, imageBase64: ready.data.base64, imageMediaType: ready.data.mediaType } : { caption } };
    if (ready.error === null) URL.revokeObjectURL(ready.data.previewUrl);
  } else {
    body = { job, at: now.toISOString() };
  }
  await fetch("/api/demo/head-start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Starts the coming beat's slow Muse call early, once per run (a new run clock starts over). */
export function useHeadStart(beat: Beat, context: BeatContext): void {
  const started = useRef<{ run: Date | null; jobs: Set<Job> }>({ run: null, jobs: new Set() });
  const job = jobFor(beat);
  const now = context.now;
  useEffect(() => {
    if (started.current.run !== now) started.current = { run: now, jobs: new Set() };
    if (!job || started.current.jobs.has(job)) return;
    started.current.jobs.add(job);
    // Not cleared when the beat moves on: the head start is for the beats after this one.
    setTimeout(() => void startJob(job, now).catch(() => {}), job === "walk-home" && beat.id === "O5" ? AFTER_POST_MS : 0);
  }, [job, now, beat.id]);
}
