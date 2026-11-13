/* eslint-disable @next/next/no-img-element */
import type { ConnectorMark } from "@/lib/curate/connectors";

// The official mark of each source Muse reads on a first visit, shown as is:
// never recolored, cropped, or redrawn. Where each file in public/brand/ came from:
// - google-calendar.png: Google Calendar's product icon (2020), 192 x 192, from
//   Google's own product logo set at www.gstatic.com/images/branding/productlogos/
//   calendar_2020q4/v13/web-96dp/logo_calendar_2020q4_color_2x_web_96dp.png
// - gmail.png: Gmail's product icon (2020), 192 x 192, from the same Google set:
//   www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/web-96dp/
//   logo_gmail_2020q4_color_2x_web_96dp.png
// - instagram-glyph.png and facebook-f.svg: Meta's own files, already in the repo
//   (their sources are noted in components/demo/brand-mark.tsx and the SVG itself).

const MARKS: Record<ConnectorMark, { src: string; alt: string }> = {
  "google-calendar": { src: "/brand/google-calendar.png", alt: "Google Calendar" },
  gmail: { src: "/brand/gmail.png", alt: "Gmail" },
  instagram: { src: "/brand/instagram-glyph.png", alt: "Instagram" },
  facebook: { src: "/brand/facebook-f.svg", alt: "Facebook" },
};

/** A source's official mark at a square size. Decorative: the row names the source. */
export function SourceMark({ mark, size }: { mark: ConnectorMark; size: number }) {
  return (
    <img
      src={MARKS[mark].src}
      alt=""
      aria-hidden
      draggable={false}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="inline-block shrink-0 select-none object-contain"
    />
  );
}
