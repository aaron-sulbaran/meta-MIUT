// Event images as poster compositions: color fields, one bold shape, big type.
// No hotlinks; every poster is drawn from its seed string so the same event
// always gets the same poster. An event with its own flyer (a local image path)
// shows the flyer in the same frame instead.

type Palette = { field: string; shape: string; ink: string; accent: string };

const PALETTES: Palette[] = [
  { field: "#ffd84d", shape: "#ff5a5f", ink: "#1b1b1b", accent: "#1b1b1b" },
  { field: "#1f3d8a", shape: "#5aa8ff", ink: "#ffffff", accent: "#ffd84d" },
  { field: "#f4ece1", shape: "#2f7d4f", ink: "#14281d", accent: "#2f7d4f" },
  { field: "#2b1d3f", shape: "#ff4f8b", ink: "#fff1f6", accent: "#ffd84d" },
  { field: "#e3efff", shape: "#0866ff", ink: "#0b1d3a", accent: "#0866ff" },
  { field: "#c9f0d9", shape: "#0f6e57", ink: "#06281f", accent: "#0f6e57" },
  { field: "#111418", shape: "#3ddc97", ink: "#ffffff", accent: "#3ddc97" },
];

const DEFAULT_PALETTE: Palette = { field: "#e3efff", shape: "#0866ff", ink: "#0b1d3a", accent: "#0866ff" };

const LAYOUTS = ["sun", "bands", "dots", "arch"] as const;
type Layout = (typeof LAYOUTS)[number];

function hash(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function posterStyle(seed: string): { palette: Palette; layout: Layout } {
  const value = hash(`${seed}:poster`);
  const palette = PALETTES[value % PALETTES.length] ?? DEFAULT_PALETTE;
  const layout = LAYOUTS[(value >>> 8) % LAYOUTS.length] ?? "sun";
  return { palette, layout };
}

function Shape({ layout, palette }: { layout: Layout; palette: Palette }) {
  switch (layout) {
    case "sun":
      return <circle cx="330" cy="70" r="120" fill={palette.shape} />;
    case "bands":
      return (
        <g fill={palette.shape}>
          <path d="M250 0h46L196 200h-46Z" />
          <path d="M330 0h46L276 200h-46Z" />
          <path d="M410 0h46L356 200h-46Z" />
        </g>
      );
    case "dots":
      return (
        <g fill={palette.shape}>
          {Array.from({ length: 30 }, (_, index) => (
            <circle key={index} cx={262 + (index % 6) * 26} cy={22 + Math.floor(index / 6) * 38} r="8" />
          ))}
        </g>
      );
    case "arch":
      return <path d="M240 200v-70a80 80 0 0 1 160 0v70Z" fill={palette.shape} />;
  }
}

/**
 * A 2:1 poster. `title` is set large; `kicker` is a short line above it.
 * `size` scales the type for compact cards.
 */
export function Poster({
  seed,
  title,
  kicker,
  size = "large",
  className = "",
  imagePath,
}: {
  seed: string;
  title: string;
  kicker?: string;
  size?: "large" | "small";
  className?: string;
  imagePath?: string;
}) {
  if (imagePath) return <Flyer src={imagePath} className={className} />;
  const { palette, layout } = posterStyle(seed);
  const titleSize = size === "large" ? "text-[30px] leading-[31px] line-clamp-3" : "text-[17px] leading-[18px] line-clamp-2";
  const kickerSize = size === "large" ? "text-[13px]" : "text-[10px]";
  return (
    <div
      aria-hidden
      className={`relative aspect-[2/1] w-full overflow-hidden ${className}`}
      style={{ backgroundColor: palette.field, color: palette.ink }}
    >
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        <Shape layout={layout} palette={palette} />
      </svg>
      <div className={`absolute inset-y-0 left-0 flex w-[68%] flex-col justify-end ${size === "large" ? "p-4" : "p-2.5"}`}>
        {kicker && (
          <span className={`${kickerSize} mb-1 truncate font-bold`} style={{ color: palette.accent }}>
            {kicker}
          </span>
        )}
        <span className={`${titleSize} font-extrabold tracking-[-0.02em]`}>{title}</span>
      </div>
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" />
    </div>
  );
}

// The whole flyer fits the 2:1 frame, over a blurred copy of itself so the frame never looks empty.
function Flyer({ src, className }: { src: string; className: string }) {
  return (
    <div aria-hidden className={`relative aspect-[2/1] w-full overflow-hidden bg-wash ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-[14px] opacity-70" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" />
    </div>
  );
}
