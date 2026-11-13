/* Recap deck, after the skit: what Muse just did. Six moments the room watched live,
   one click each: the real screen it happened on, the model that did it, and the time
   measured for it (motion/opening/timings-local.json; sources in facts.json). Aaron
   talks over each moment, so the screen holds a calm picture and a few words, and
   the runtime plays no effects under him. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const PHONE = { x: 560 - 200, y: 107 };
  const EMBER = "Muse Ember";
  const VOICE = "Muse Voice Transcribe";
  /* Labels stay at five words or fewer; Aaron's line carries the rest. */
  const MOMENTS = [
    { label: "Read the club’s flyer", model: EMBER, time: "about 2 seconds", note: "Muse read Jing's flyer into a Facebook event." },
    { label: "Planned her walk home", model: EMBER, time: "about 5 seconds", note: "It planned Jolyn's walk home around her class." },
    { label: "Heard what she said", model: VOICE, time: "about 3 seconds", note: "It heard what she said." },
    { label: "Re-planned, sent the invite", model: EMBER, time: "about 2 seconds", note: "It re-planned for two and sent Lisa the invite." },
    { label: "Built her first feed", model: EMBER, time: "about 4 seconds", note: "It built Trish a first feed from what she follows." },
    { label: "Found people, wrote the hello", model: EMBER, time: "about 2 seconds", note: "And it found her people to go with, and wrote the hello." },
  ];

  function prepare() {
    const col = $("#r-col");
    MOMENTS.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "moment";
      el.id = `r-m${i + 1}`;
      el.innerHTML = `<p class="m-label">${m.label}</p><p class="m-model"><img src="../shared/brand/meta-ai.png" alt="Meta AI" />${m.model}</p><p class="m-time">${m.time}</p>`;
      col.appendChild(el);
    });
    gsap.set("#r-phone", { x: PHONE.x, y: PHONE.y });
  }

  const segments = () => $$("#r-progress i");

  /* One moment: the phone's screen changes in place, the words change beside it, and
     the next progress segment fills. Every earlier state is set first, so any moment
     can be cut without breaking the rest. */
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
          ctx.ft(seg, `#r-m${k - 1}`, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.35, ease: "power2.in" }, 0);
        }
        ctx.ft(seg, `#r-s${k}`, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, k === 1 ? 0.25 : 0.1);
        ctx.ft(seg, `#r-m${k}`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, k === 1 ? 0.7 : 0.35);
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
      title: "Six live calls to Meta's Muse models",
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
