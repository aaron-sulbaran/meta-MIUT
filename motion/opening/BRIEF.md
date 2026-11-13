---
workflow: slideshow
flow: companion
storyboard: no
message: "We don't scroll Facebook, we use it to get things done; Muse turns the campus events already being shared into a feed and map students actually use."
destination: live pitch, /demo stage at 1920 x 1080 on a projector, plus a rendered backup film
aspect: 1920x1080
language: en
length: about 2 minutes of material, split into click-driven steps; cuts after the first run-through
---

## Intent

The opening of the team's Meta "Closer Together" hackathon pitch (Friday Nov 13, 2026), built from Jolyn's motion script and spoken script. Aaron presents it live and talks over it. It should feel like a launch film, but every moment waits for a click. It ends by handing over to a four-person skit about one event, Board Game Night.

## Stated by Aaron (settled, via the lead's brief)

- Click-driven, never timed between moments. Each click plays the next moment at its designed timing, then rests on a frame that stays alive. Every step and scene must be removable.
- Two decks, each a static self-contained page with no network at runtime: `public/demo/deck/problem/` (Jolyn's scenes 1 to 5) and `public/demo/deck/muse/` (scenes 6 and 7). Designed at 1920 x 1080, scaled to fit, letterboxed on near-black.
- Host contract with the stage (`components/demo/deck-host.tsx`): same-origin postMessage, `ready`, `step`, `end`, `start`; `next`, `back`, `goto`. Keys work alone and embedded. `steps.json` beside each deck with the spoken line per step.
- Jolyn's palette and mood govern: #08090D, #0866FF, white, #A2A7B3, #292C35, hard cuts to black on reveals.
- Facts lock (`public/demo/deck/facts.json`). The 50 stays. Only the six real survey replies in facts.json are ever readable (changed from three after the 2026-11-13 dry run). Never write a reply.
- Real logos only, unmodified. No photos of anyone, no real people. Never imply Instagram sharing already creates Facebook events.
- One world with the product: MIT, the team's seeded flyers, real captures of this app, Board Game Night as the story event.
- Sound built but off by default, one key to turn it on. Nothing loud over a spoken line.
- No product name on screen.

## Inferred or decided here (correct me)

- Display face: Geologica 700 (the product's display face), body in Inter; both shipped locally.
- Renderer: a small GSAP runtime (`shared/deck.js`) rather than the HyperFrames slideshow component, because the slideshow seeks to rest frames instead of playing moments and owns its own navigation, which the stage contract replaces. Each deck is still one paused, seekable GSAP timeline registered at `window.__timelines[id]`, so frames can be captured and a film rendered.
- A click during a moment fast-forwards it to its rest instead of skipping it.
- Scene 2's on-screen lines follow the spoken script ("It's not just an app to scroll. / It's an app to DO.") over the motion script's ("We don't need another feed to scroll. / We need a reason to open the app.").
- Sound is synthesized with WebAudio (no files); the on/off choice is remembered per browser.
- Jolyn's "Now / Today / This week" filters do not exist in the app, so they are not shown.

## Notes

- Tools: `tools/frames.mjs` (exact frames by seeking the timeline), `tools/fps.mjs` (frame times while a step plays), `tools/seams.mjs` (jumps at clicks and one-frame flashes), `tools/qr-check.mjs` (decodes a deck's QR code at 1920, 1280 and 1024), `tools/appshots.mjs` (real app captures), `tools/cap.sh` (wrapper). Browser runs go through the machine's two-slot Playwright limit, and use software rendering (`--disable-gpu`; `DECK_GPU=1` for frames.mjs to opt back in): a GPU shared with other agents' browsers stalled seeks.
- Captures: `tools/capture-pass.sh <dir>` then `python3 tools/apply-pass.py <dir>` retakes every app screen the decks show in one pass (390 x 797, the app area below the stage phone's status bar; fresh server per run where the app answers once), and rewrites the recap's proof and facts from the same runs.
- Closing decks (after the 2026-11-13 dry run): `next` (future applications, then the thank you with the QR code) and `appendix` (how we built it, then one slide per expected question, behind the thank you). Their words live in `content.json` beside each deck; edit there, not in the animation.
- Opening QR: `node motion/opening/tools/opening-qr.mjs on|off` flips `openingQr` in `public/demo/deck/problem/content.json` and keeps `steps.json` in step. The code itself is `shared/qr-live.svg`, made by `tools/make-qr.mjs`.
