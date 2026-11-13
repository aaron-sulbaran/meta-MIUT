"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";

// A film beat on the stage: one video, full bleed, no chrome, stepped by its
// cue points (seconds, from <film>.cues.json). Arriving plays up to the first
// cue and holds. Next plays on to the following cue and holds; after the last
// cue, Next belongs to the stage (the following beat). Back jumps to the
// previous cue and holds. With no cues file, the film plays once to its end.

export type FilmControls = {
  /** Plays to the next cue; false when the film is already past its last cue. */
  next: () => boolean;
  /** Returns to the previous cue; false when it is already at the first. */
  back: () => boolean;
};

type Box<T> = { current: T };

/** Each frame, checks whether the film reached its stop; there it pauses and holds. */
function watchForStop(video: HTMLVideoElement, stopAt: Box<number | null>, frame: Box<number | null>) {
  const target = stopAt.current;
  if (target === null) return;
  if (video.currentTime >= target - 0.03) {
    video.pause();
    video.currentTime = target;
    stopAt.current = null;
    return;
  }
  frame.current = requestAnimationFrame(() => watchForStop(video, stopAt, frame));
}

export function FilmPlayer({ src, cues, controls }: { src: string; cues: number[]; controls: Ref<FilmControls | null> }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The cue the film is heading to or holding on.
  const cueRef = useRef(0);
  const stopAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  // The browser refused to start the film with sound before anyone pressed a key:
  // the next press starts it (to the cue it was heading for) instead of skipping ahead.
  const blockedRef = useRef<number | null | false>(false);

  const playTo = useCallback(
    (stopAt: number | null) => {
      const video = videoRef.current;
      if (!video) return;
      stopAtRef.current = stopAt;
      blockedRef.current = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      video.play().catch(() => {
        blockedRef.current = stopAt;
      });
      if (stopAt !== null) frameRef.current = requestAnimationFrame(() => watchForStop(video, stopAtRef, frameRef));
    },
    [],
  );

  const holdAt = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    stopAtRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    video.pause();
    video.currentTime = time;
  }, []);

  // Arriving: play from the start to the first cue (or to the end without cues).
  useEffect(() => {
    cueRef.current = 0;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    if (cues.length === 0) playTo(null);
    else if (cues[0]! <= 0.05) holdAt(0);
    else playTo(cues[0]!);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [src, cues, playTo, holdAt]);

  useImperativeHandle(
    controls,
    () => ({
      next: () => {
        if (blockedRef.current !== false) {
          playTo(blockedRef.current);
          return true;
        }
        if (cueRef.current >= cues.length - 1) return false;
        cueRef.current += 1;
        playTo(cues[cueRef.current]!);
        return true;
      },
      back: () => {
        if (cueRef.current <= 0) return false;
        cueRef.current -= 1;
        holdAt(cues[cueRef.current]!);
        return true;
      },
    }),
    [cues, playTo, holdAt],
  );

  return <video ref={videoRef} src={src} playsInline preload="auto" className="absolute inset-0 z-10 h-full w-full bg-black object-contain" />;
}
