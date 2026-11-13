/* eslint-disable @next/next/no-img-element */

// Meta AI's mark: the ring of seven petals, pink to blue. The file is Meta AI's
// own flat mark (public/brand/meta-ai.png, 1280 x 1280, transparent, from Meta
// AI's 2026 brand assets), shown as is: never recolored, cropped, or redrawn.
// It is the one small "AI is here" indicator in the product. Sprout, the team's
// green mascot, is a different thing and stays where he is.
//
// `working` moves the real image the way Meta AI's own motion does while it
// thinks: the ring turns clockwise and breathes a little. Only rotation, scale,
// and opacity of the whole image; the petals are never drawn separately.
// Reduced motion keeps it still.

const MOTION_CSS = `
@keyframes meta-ai-turn {
  0% { transform: rotate(0deg) scale(0.94); opacity: 0.9; }
  50% { transform: rotate(180deg) scale(1.04); opacity: 1; }
  100% { transform: rotate(360deg) scale(0.94); opacity: 0.9; }
}
@keyframes meta-ai-arrive {
  0% { transform: rotate(-90deg) scale(0.6); opacity: 0; }
  100% { transform: rotate(0deg) scale(1); opacity: 1; }
}
.meta-ai-working { animation: meta-ai-turn 2.4s linear infinite; }
.meta-ai-arrive { animation: meta-ai-arrive 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .meta-ai-working, .meta-ai-arrive { animation: none; }
}
`;

export const META_AI_MARK_SRC = "/brand/meta-ai.png";

/**
 * Meta AI's real mark at a square pixel size. Decorative by default (the text
 * beside it says Muse); pass `label` when it stands alone.
 */
export function MetaAiMark({
  size,
  working = false,
  arrive = false,
  label,
  className = "",
}: {
  size: number;
  working?: boolean;
  arrive?: boolean;
  label?: string;
  className?: string;
}) {
  const motion = working ? "meta-ai-working" : arrive ? "meta-ai-arrive" : "";
  return (
    <>
      {(working || arrive) && <style>{MOTION_CSS}</style>}
      <img
        src={META_AI_MARK_SRC}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        draggable={false}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`inline-block shrink-0 select-none object-contain ${motion} ${className}`}
      />
    </>
  );
}
