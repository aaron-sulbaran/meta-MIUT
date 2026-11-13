// The official Meta, Facebook, and Instagram marks (public/brand/), shown
// unmodified: never redrawn, recolored, or cropped. Every demo moment draws a
// mark through here, so a file change is one edit.

const MARKS = {
  facebook: { src: "/brand/facebook-f.svg", alt: "Facebook" },
  instagram: { src: "/brand/instagram-glyph.png", alt: "Instagram" },
  meta: { src: "/brand/meta-lockup.svg", alt: "Meta" },
} as const;

export type BrandName = keyof typeof MARKS;

export function BrandMark({ name, className = "h-[16px] w-auto", decorative = false }: { name: BrandName; className?: string; decorative?: boolean }) {
  const mark = MARKS[name];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mark.src} alt={decorative ? "" : mark.alt} aria-hidden={decorative || undefined} className={`shrink-0 object-contain ${className}`} />;
}
