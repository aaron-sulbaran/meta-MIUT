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
- Facts lock (`public/demo/deck/facts.json`). The 50 stays. Only three survey replies are ever readable. Never write a reply.
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

- Tools: `tools/frames.mjs` (exact frames by seeking the timeline), `tools/fps.mjs` (frame times while a step plays), `tools/appshots.mjs` (real app captures), `tools/cap.sh` (wrapper). Browser runs go through the machine's two-slot Playwright limit.
