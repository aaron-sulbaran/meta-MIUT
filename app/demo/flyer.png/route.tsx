import { demoClock } from "@/lib/demo/clock";
import { ImageResponse } from "next/og";
import { STORY_POST, storyTimeLine } from "@/lib/demo/staged";

// The story event's flyer, drawn (no photos), as the organizer posts it on
// Instagram in the demo. Drawn at request time so its time line matches the
// demo clock; Muse reads it like any flyer photo. ?at=<ISO> pins the clock.

export const dynamic = "force-dynamic";

const INK = "#2b1d14";
const CREAM = "#fff3d6";
const RED = "#e2483d";
const TEAL = "#1f8a83";

function Dumpling({ size, x, y, tilt }: { size: number; x: number; y: number; tilt: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size * 0.62,
        display: "flex",
        transform: `rotate(${tilt}deg)`,
        background: "#fffaf0",
        border: `6px solid ${INK}`,
        borderRadius: `${size}px ${size}px ${size * 0.18}px ${size * 0.18}px`,
      }}
    >
      <div style={{ position: "absolute", left: size * 0.22, top: size * 0.08, width: 6, height: size * 0.22, background: INK, borderRadius: 3, display: "flex" }} />
      <div style={{ position: "absolute", left: size * 0.46, top: size * 0.02, width: 6, height: size * 0.26, background: INK, borderRadius: 3, display: "flex" }} />
      <div style={{ position: "absolute", left: size * 0.7, top: size * 0.08, width: 6, height: size * 0.22, background: INK, borderRadius: 3, display: "flex" }} />
    </div>
  );
}

function Die({ size, x, y, tilt, pips }: { size: number; x: number; y: number; tilt: number; pips: [number, number][] }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        display: "flex",
        transform: `rotate(${tilt}deg)`,
        background: "#ffffff",
        border: `6px solid ${INK}`,
        borderRadius: size * 0.2,
      }}
    >
      {pips.map(([px, py], index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: px * size - 11,
            top: py * size - 11,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: INK,
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}

export function GET(request: Request) {
  const at = new URL(request.url).searchParams.get("at");
  const now = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();
  const timeLine = storyTimeLine(now).toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: CREAM, color: INK, position: "relative" }}>
        <div style={{ display: "flex", height: 34, background: RED }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 80px 0" }}>
          <div style={{ display: "flex", fontSize: 40, letterSpacing: 6, color: TEAL }}>{STORY_POST.organizer.name.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 132, lineHeight: 1, letterSpacing: -4 }}>
            <span style={{ display: "flex", lineHeight: 1 }}>BOARD GAME</span>
            <span style={{ display: "flex", lineHeight: 1 }}>NIGHT</span>
            <span style={{ display: "flex", lineHeight: 1, fontSize: 84, marginTop: 20, color: RED }}>+ FREE DUMPLINGS</span>
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, top: 690, height: 260, display: "flex" }}>
          <Dumpling size={200} x={90} y={70} tilt={-8} />
          <Dumpling size={170} x={310} y={110} tilt={6} />
          <Die size={135} x={600} y={40} tilt={12} pips={[[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]]} />
          <Die size={120} x={790} y={115} tilt={-10} pips={[[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]} />
        </div>

        <div style={{ position: "absolute", left: 80, right: 80, bottom: 90, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignSelf: "flex-start", background: INK, color: CREAM, fontSize: 58, padding: "18px 34px", borderRadius: 999 }}>
            {`TODAY · ${timeLine}`}
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 52 }}>{STORY_POST.placeName}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 38, color: TEAL }}>Open to everyone · 40 games · no experience needed</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, background: TEAL, display: "flex" }} />
      </div>
    ),
    { width: 1080, height: 1350, headers: { "cache-control": "no-store" } },
  );
}
