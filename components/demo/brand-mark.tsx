/* eslint-disable @next/next/no-img-element */

// The one place the demo's screens draw a brand mark. Each is the official file
// in public/brand/ (where each came from is noted in the file), shown as is:
// never recolored, cropped, or redrawn. There is no official Facebook or
// Instagram wordmark, so those stay as type where they appear.

const MARKS = {
  meta: { src: "/brand/meta-lockup.svg", alt: "Meta" },
  facebook: { src: "/brand/facebook-f.svg", alt: "Facebook" },
  instagram: { src: "/brand/instagram-glyph.png", alt: "Instagram" },
} as const;

export type BrandMarkName = keyof typeof MARKS;

/** An official mark at a given height (the Meta lockup keeps its own width). */
export function BrandMark({ name, size, className = "", decorative = false }: { name: BrandMarkName; size: number; className?: string; decorative?: boolean }) {
  const mark = MARKS[name];
  return (
    <img
      src={mark.src}
      alt={decorative ? "" : mark.alt}
      aria-hidden={decorative || undefined}
      height={size}
      width={name === "meta" ? undefined : size}
      style={{ height: size, width: name === "meta" ? "auto" : size }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
