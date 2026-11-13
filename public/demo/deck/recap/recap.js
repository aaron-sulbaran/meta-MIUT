/* Recap deck, after the skit: what Muse just did. Six moments the room watched live,
   one click each: the real screen it happened on, the model that did it, and how long it
   took. Each moment shows the median run of one capture pass (motion/opening/tools/
   recap-pass.mjs, written to proof.js): that run's screen, that run's own time stamp ringed
   on it, and the same number counted up beside it, so the screen and the number always
   agree. Aaron talks over each moment, so the screen holds a calm picture and a few words,
   and the runtime plays no effects under him. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const PHONE = { x: 560 - 200, y: 107 };
  const EMBER = "Muse Ember";
  const VOICE = "Muse Voice Transcribe";
  /* Labels stay at five words or fewer; Aaron's line carries the rest. */
  const MOMENTS = [
    { key: "flyer", label: "Read the club’s flyer", model: EMBER, note: "Muse read Jing's flyer into a Facebook event." },
    { key: "walk", label: "Planned her walk home", model: EMBER, note: "It planned Jolyn's walk home around her class." },
    { key: "heard", label: "Heard what she said", model: VOICE, note: "It heard what she said." },
    { key: "replan", label: "Re-planned, sent the invite", model: EMBER, note: "It re-planned for two and sent Lisa the invite." },
    { key: "picks", label: "Built her first feed", model: EMBER, note: "It built Trish a first feed from what she follows." },
    { key: "hello", label: "Found people, wrote the hello", model: EMBER, note: "And it found her people to go with, and wrote the hello." },
  ];
  const PROOF = window.RECAP_PROOF || {};

  /* A box in the 390 x 844 capture, in the phone screen's pixels (cover-fit, cropped at the sides). */
  function screenBox(box) {
    const k = 842 / 844;
    const crop = (390 * k - 376) / 2;
    const pad = 7;
    return { left: box.x * k - crop - pad, top: box.y * k - pad, width: box.width * k + pad * 2, height: box.height * k + pad * 2 };
  }

  function prepare() {
    const col = $("#r-col");
    const screen = $("#r-phone .screen");
    MOMENTS.forEach((m, i) => {
      const p = PROOF[m.key] || {};
      if (p.file) $(`#r-s${i + 1}`).src = `../shared/captures/${p.file}`;
      const el = document.createElement("div");
      el.className = "moment";
      el.id = `r-m${i + 1}`;
      el.innerHTML = `<p class="m-label">${m.label}</p><p class="m-model"><img src="../shared/brand/meta-ai.png" alt="Meta AI" />${m.model}</p><p class="m-time"><span class="num"><span class="w">${Math.floor(p.seconds || 0)}</span>.<span class="t">${Math.round((p.seconds || 0) * 10) % 10}</span></span> seconds</p>`;
      col.appendChild(el);
      if (p.box) {
        const ring = document.createElement("i");
        ring.className = "proof";
        ring.id = `r-p${i + 1}`;
        const b = screenBox(p.box);
        Object.assign(ring.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
        ring.innerHTML = "<b></b>";
        screen.appendChild(ring);
      }
    });
    gsap.set("#r-phone", { x: PHONE.x, y: PHONE.y });
  }

  const segments = () => $$("#r-progress i");

  /* The number counts up to the run's own time, landing as the ring finds it on the screen.
     Discrete text sets on an eased curve (not an update callback), so a seek to any rest,
     Back, or a jump from the stage always shows the right number. */
  function countUp(seg, k, at) {
    const target = (PROOF[MOMENTS[k - 1].key] || {}).seconds || 0;
    /* Whole seconds and tenths live in separate spans: GSAP reads "2.0" as 2, but "2" and "0" stay themselves. */
    const whole = $(`#r-m${k} .num .w`);
    const tenth = $(`#r-m${k} .num .t`);
    const ticks = 14;
    const duration = 0.9;
    const show = (value, time) => {
      const tenths = Math.round(value * 10);
      seg.set(whole, { textContent: String(Math.floor(tenths / 10)) }, time);
      seg.set(tenth, { textContent: String(tenths % 10) }, time);
    };
    show(0, 0);
    for (let i = 1; i <= ticks; i++) {
      const p = i / ticks;
      show(target * (1 - Math.pow(1 - p, 2)), at + duration * p);
    }
  }

  /* One moment: the phone's screen changes in place, the words change beside it, the next
     progress segment fills, the ring finds the proof and the time counts up to it. Every
     earlier state is set first, so any moment can be cut without breaking the rest. */
  function moment(k) {
    const m = MOMENTS[k - 1];
    return {
      id: `moment-${k}`,
      title: m.label,
      lead: "speaker",
      notes: m.note,
      build(seg, ctx) {
        ctx.show(seg, "r1");
        const bars = segments();
        bars.forEach((bar, i) => seg.set(bar, { "--fill": i < k - 1 ? 1 : 0 }, 0));
        ctx.ft(seg, bars[k - 1], { "--fill": 0 }, { "--fill": 1, duration: 0.7, ease: "power2.inOut" }, 0.15);
        $$("#r-phone .screen img").forEach((img, i) => seg.set(img, { opacity: i === k - 2 ? 1 : 0 }, 0));
        $$(".proof").forEach((ring) => seg.set(ring, { opacity: ring.id === `r-p${k - 1}` ? 1 : 0 }, 0));
        $$(".moment").forEach((el, i) => seg.set(el, { opacity: i === k - 2 ? 1 : 0, y: 0 }, 0));
        if (k === 1) {
          ctx.ft(seg, "#r-intro", { opacity: 1, y: 0 }, { opacity: 0, y: -60, duration: 0.5, ease: "power2.in" }, 0);
          ctx.ft(seg, "#r-phone", { opacity: 0, y: PHONE.y + 620, rotation: -3 }, { opacity: 1, y: PHONE.y, rotation: 0, duration: 1.0, ease: "power3.out" }, 0.25);
          ctx.ft(seg, ["#r-header", "#r-progress"], { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.4);
        } else {
          seg.set("#r-intro", { opacity: 0 }, 0);
          seg.set(["#r-header", "#r-progress"], { opacity: 1 }, 0);
          seg.set("#r-phone", { opacity: 1, y: PHONE.y, rotation: 0 }, 0);
          ctx.ft(seg, `#r-s${k - 1}`, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power1.inOut" }, 0.1);
          if ($(`#r-p${k - 1}`)) ctx.ft(seg, `#r-p${k - 1}`, { opacity: 1 }, { opacity: 0, duration: 0.25 }, 0);
          ctx.ft(seg, `#r-m${k - 1}`, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.35, ease: "power2.in" }, 0);
        }
        ctx.ft(seg, `#r-s${k}`, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, k === 1 ? 0.25 : 0.1);
        ctx.ft(seg, `#r-m${k}`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, k === 1 ? 0.7 : 0.35);
        const proofAt = k === 1 ? 1.15 : 0.75;
        if ($(`#r-p${k}`)) ctx.ft(seg, `#r-p${k}`, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, proofAt);
        countUp(seg, k, proofAt);
      },
      idle(api) {
        if ($(`#r-p${k} b`)) api.loop(`#r-p${k} b`, { opacity: 0.45, duration: 1.2 });
      },
    };
  }

  const STEPS = [
    {
      id: "what-muse-did",
      title: "What Muse just did",
      lead: "speaker",
      notes: "Here's what Muse just did in that skit, live.",
      build(seg, ctx) {
        ctx.show(seg, "r1");
        ctx.ft(seg, "#r-intro .r-mark", { opacity: 0, scale: 0.6, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.9, ease: "power3.out" }, 0.15);
        ctx.ft(seg, "#r-title", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, 0.4);
      },
      idle(api) {
        api.loop("#r-intro .r-mark", { scale: 1.05, duration: 2.8 });
      },
    },
    ...MOMENTS.map((_, i) => moment(i + 1)),
    {
      id: "live-calls",
      title: "Every one a live call to Meta's Muse models",
      lead: "screen",
      notes: "Quiet. Let them read.",
      build(seg, ctx) {
        ctx.ft(seg, "#r1", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: "power2.in" }, 0);
        ctx.ft(seg, "#r2", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.5);
        ctx.ft(seg, "#r2 .r-mark", { opacity: 0, scale: 0.6, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.9, ease: "power3.out" }, 0.6);
        ctx.ft(seg, "#r-close-a", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.85);
        ctx.ft(seg, "#r-close-b", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 1.55);
        ctx.sfx(seg, "swell", { dur: 2.2, level: 0.05 }, 0.6);
      },
    },
  ];

  Deck.start({ id: "recap", steps: STEPS, prepare });
})();
