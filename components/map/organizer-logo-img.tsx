"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// An organizer's logo that never shows as broken and never hangs: on an error, or if it has
// not arrived after LOGO_WAIT_MS, the fallback (their letter mark) shows instead.
const LOGO_WAIT_MS = 2_500;

export function OrganizerLogoImg({ src, className, fallback }: { src: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const image = imageRef.current;
      if (image && !(image.complete && image.naturalWidth > 0)) setFailed(true);
    }, LOGO_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [src]);
  if (failed) return <>{fallback}</>;
  return (
    // Local copies and generated data URLs alike, so a plain img (not next/image).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
