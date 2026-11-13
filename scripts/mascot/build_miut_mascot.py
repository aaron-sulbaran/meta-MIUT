"""Sprout presents MI(U)T: the header mascot animation.

Sprout (the Muse mascot) stands still in his normal pose and holds up four
posters one at a time, M, I, (U), T, spelling the team name MI(U)T. The
posters are the motion; Sprout only lifts his hands a touch as each poster
arrives. (A body squash was tried and dropped: it redraws the whole furry
body every frame and nearly doubled the file.)

Source: sprout-wave-source.gif (Lisa's waving Sprout, 436x438, 8 frames).
Frame 3 (index 2), with both arms relaxed at his sides, is the still pose,
cut out of its white background the same way the old wave loop was.

Outputs (168x168, the size the header has always used):
  public/muse/sprout-miut.webp       animated, transparent: what the app shows
  public/muse/sprout-miut-still.png  the opening frame, for reduced motion
  public/muse/sprout-miut.gif        animated GIF on white, like the source GIF
  scripts/mascot/preview/            a contact sheet, a display-size check,
                                     and an MP4 preview (ffmpeg)

Run from the repo root:  python3 scripts/mascot/build_miut_mascot.py
Needs Pillow; the MP4 needs ffmpeg on the PATH (skipped without it).
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCE = os.path.join(HERE, "sprout-wave-source.gif")
PUBLIC = os.path.join(ROOT, "public", "muse")
PREVIEW = os.path.join(HERE, "preview")

POSE_FRAME = 2  # both arms relaxed at his sides
OUT_SIZE = 168
# The crop the old wave loop used (union of every source frame), so Sprout
# sits in the same spot and size as before.
CROP = (51, 27, 390, 416)
POSTERS = ["M", "I", "(U)", "T"]

RED = (228, 0, 43, 255)
PAPER = (255, 249, 240, 255)
PAPER_EDGE = (226, 214, 196, 255)
FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "/Library/Fonts/Arial Black.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf",
]
FONT_SIZE = 120

# Poster when held, in source pixels: below his face, between his hands.
POSTER_W, POSTER_H = 231, 150
POSTER_CX, POSTER_TOP = 216.5, 244
# His hands (in front of the poster), as soft ellipses over the arm stubs.
LEFT_HAND = (52, 212, 128, 304)
RIGHT_HAND = (300, 212, 386, 304)

FPS = 25
FRAME_MS = 1000 // FPS


# ---------------------------------------------------------------- the mascot

def cut_out(frame: Image.Image) -> Image.Image:
    """Sprout on a transparent background: near-white connected to the edges goes, and the pale floor shadow too."""
    f = frame.convert("RGB")
    w, h = f.size
    marker = f.copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)]:
        ImageDraw.floodfill(marker, seed, (255, 0, 255), thresh=28)
    r, g, _ = marker.split()
    bg = ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0))
    px, bgp = f.load(), bg.load()
    for y in range(int(h * 0.86), h):
        for x in range(w):
            pr, pg, pb = px[x, y]
            if max(pr, pg, pb) - min(pr, pg, pb) < 20 and min(pr, pg, pb) > 130:
                bgp[x, y] = 255
    alpha = bg.point(lambda v: 255 - v).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = f.convert("RGBA")
    out.putalpha(alpha)
    return out


def hand_layer(body: Image.Image) -> Image.Image:
    """Just his two hands, feathered, to draw in front of the poster so he grips its top corners."""
    mask = Image.new("L", body.size, 0)
    d = ImageDraw.Draw(mask)
    d.ellipse(LEFT_HAND, fill=255)
    d.ellipse(RIGHT_HAND, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    hands = body.copy()
    hands.putalpha(ImageChops.multiply(body.getchannel("A"), mask))
    return hands


# ---------------------------------------------------------------- the posters

def load_font() -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        if os.path.exists(path):
            return ImageFont.truetype(path, FONT_SIZE)
    sys.exit("Arial Black not found; add a bold sans font path to FONT_PATHS.")


def poster(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """A clean off-white sign with one big red character (or (U)), centered, with a soft shadow."""
    pad = 12  # room for the shadow
    sign = Image.new("RGBA", (POSTER_W + pad * 2, POSTER_H + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("L", sign.size, 0)
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 4, pad + POSTER_W, pad + POSTER_H + 4), radius=14, fill=70)
    sign.paste((40, 60, 50, 255), (0, 0), shadow.filter(ImageFilter.GaussianBlur(5)))
    d = ImageDraw.Draw(sign)
    d.rounded_rectangle((pad, pad, pad + POSTER_W, pad + POSTER_H), radius=14, fill=PAPER, outline=PAPER_EDGE, width=3)
    left, top, right, bottom = font.getbbox(text)
    x = pad + (POSTER_W - (right - left)) / 2 - left
    y = pad + (POSTER_H - (bottom - top)) / 2 - top
    d.text((x, y), text, font=font, fill=RED)
    return sign


# ---------------------------------------------------------------- one frame

def ease_out_back(t: float, s: float = 0.7) -> float:
    t -= 1
    return t * t * ((s + 1) * t + s) + 1


def ease_in_cubic(t: float) -> float:
    return t * t * t


def render(body: Image.Image, hands: Image.Image, sign: Image.Image | None, lift: float) -> Image.Image:
    """Sprout with the poster `lift` of the way up (0 down and gone, 1 held). His body never changes."""
    canvas = body.copy()
    if sign is not None and lift > 0.001:
        held = min(lift, 1.0)
        scale = 0.88 + 0.12 * held
        s = sign.resize((round(sign.width * scale), round(sign.height * scale)), Image.LANCZOS)
        opacity = min(1.0, held * 2.0)
        if opacity < 1:
            s.putalpha(s.getchannel("A").point(lambda v: int(v * opacity)))
        # Rises from lower down into place; lift > 1 is the small overshoot of the raise.
        top = POSTER_TOP + (1 - lift) * 40 - 12 * scale
        left = POSTER_CX - s.width / 2
        canvas.alpha_composite(s, (round(left), round(top)))
        # His hands lift a touch with the poster and stay in front of it.
        hand_up = round(3 * held)
        canvas.alpha_composite(hands, (0, -hand_up))
    return canvas


def to_output(frame: Image.Image) -> Image.Image:
    """Crop like the old wave loop, square it, and scale to the header size."""
    c = frame.crop(CROP)
    side = max(c.width, c.height) + 8
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(c, ((side - c.width) // 2, side - c.height - 4))
    return sq.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)


# ---------------------------------------------------------------- the timeline

def timeline() -> list[tuple[int | None, float, int, str]]:
    """(poster index or None, lift, duration ms, label) for every frame."""
    frames: list[tuple[int | None, float, int, str]] = []
    # The loop's rest is this plus "neutral end" (identical frames): about 1.5 s.
    frames.append((None, 0, 450, "neutral start"))
    raise_n, lower_n = 9, 7
    for i, _ in enumerate(POSTERS):
        for k in range(1, raise_n + 1):
            frames.append((i, ease_out_back(k / raise_n), FRAME_MS, f"raise {POSTERS[i]}"))
        # Held still while it reads: about a second, the last one (T) longer.
        hold = 1400 if i == len(POSTERS) - 1 else 1000
        frames.append((i, 1, hold, f"hold {POSTERS[i]}"))
        for k in range(1, lower_n + 1):
            frames.append((i, 1 - ease_in_cubic(k / lower_n), FRAME_MS, f"lower {POSTERS[i]}"))
        if i < len(POSTERS) - 1:
            frames.append((None, 0, 220, "between"))
    frames.append((None, 0, 1100, "neutral end"))
    return frames


def main() -> None:
    src = Image.open(SOURCE)
    src.seek(POSE_FRAME)
    body = cut_out(src)
    hands = hand_layer(body)
    font = load_font()
    signs = [poster(text, font) for text in POSTERS]

    plan = timeline()
    frames, durations, labels = [], [], []
    for index, lift, ms, label in plan:
        frames.append(to_output(render(body, hands, signs[index] if index is not None else None, lift)))
        durations.append(ms)
        labels.append(label)

    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)

    webp = os.path.join(PUBLIC, "sprout-miut.webp")
    frames[0].save(webp, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=85, method=6, minimize_size=True)
    frames[0].save(os.path.join(PUBLIC, "sprout-miut-still.png"), optimize=True)

    # The GIF sits on white like the source GIF (GIF has no soft edges, so the fur stays clean).
    flat = [Image.alpha_composite(Image.new("RGBA", f.size, (255, 255, 255, 255)), f).convert("RGB") for f in frames]
    # One palette for every frame, so colors do not flicker between frames.
    strip = Image.new("RGB", (OUT_SIZE * len(flat), OUT_SIZE))
    for i, f in enumerate(flat):
        strip.paste(f, (i * OUT_SIZE, 0))
    palette = strip.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    gif_frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in flat]
    gif = os.path.join(PUBLIC, "sprout-miut.gif")
    gif_frames[0].save(gif, save_all=True, append_images=gif_frames[1:], duration=durations, loop=0, optimize=True, disposal=1)

    # Quality checks: key frames at full size, and the whole cycle at display size.
    keys = [labels.index("neutral start")] + [labels.index(f"hold {p}") for p in POSTERS] + [len(labels) - 1]
    sheet = Image.new("RGB", (OUT_SIZE * len(keys), OUT_SIZE + 22), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for n, k in enumerate(keys):
        sheet.paste(flat[k], (n * OUT_SIZE, 0))
        d.text((n * OUT_SIZE + 6, OUT_SIZE + 5), labels[k], fill=(60, 60, 60))
    sheet.save(os.path.join(PREVIEW, "key-frames.png"))
    small = Image.new("RGB", (60 * len(keys), 60), (255, 255, 255))
    for n, k in enumerate(keys):
        small.paste(flat[k].resize((44, 44), Image.LANCZOS), (n * 60 + 8, 8))
    small.save(os.path.join(PREVIEW, "key-frames-44px.png"))

    if shutil.which("ffmpeg"):
        # Expand per-frame durations into a constant 25 fps stream for the MP4.
        tmp = os.path.join(PREVIEW, "_frames")
        os.makedirs(tmp, exist_ok=True)
        n = 0
        for f, ms in zip(flat, durations):
            for _ in range(max(1, round(ms / FRAME_MS))):
                f.resize((OUT_SIZE * 2, OUT_SIZE * 2), Image.LANCZOS).save(os.path.join(tmp, f"{n:04d}.png"))
                n += 1
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(tmp, "%04d.png"),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(PREVIEW, "sprout-miut-preview.mp4")],
            check=True,
        )
        shutil.rmtree(tmp)

    total = sum(durations)
    print(f"{len(frames)} frames, {total / 1000:.1f} s loop")
    for path in (webp, gif):
        print(f"{os.path.relpath(path, ROOT)}: {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
