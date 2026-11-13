/* Muse deck, before the skit (about 20 seconds): the models behind it, what a student
   sees, the promise, and the four people who show it live. Jing's live act is the first
   time the room sees Muse read a flyer, so the organizer walkthrough is not here.
   Every step sets its own start states, so any step can be cut from STEPS. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  const MARK = { cx: 960, cy: 250, size: 132 };
  /* Phones at 90 percent, by center. */
  const MAP = { cx: 560, cy: 590 };
  const LIST = { cx: 1010, cy: 590 };
  const PHONE_SCALE = 0.9;
  const SLOT = { cx: 0, cy: 0, size: 64 };

  /* A y in the 390 x 844 capture to stage pixels inside the list phone. */
  function listY(y) {
    const screenTop = LIST.cy - 433 * PHONE_SCALE + 12 * PHONE_SCALE;
    return screenTop + y * (842 / 844) * PHONE_SCALE;
  }

  /* The two sections of the real List view, by where they sit in the capture. */
  const CALLOUTS = [
    { sel: "#md-c1", from: 125, to: 355 },
    { sel: "#md-c2", from: 377, to: 760 },
  ];

  function prepare() {
    const head = $("#md-head");
    const slot = $("#md-slot");
    SLOT.cx = head.offsetLeft + slot.offsetLeft + SLOT.size / 2;
    SLOT.cy = head.offsetTop + slot.offsetTop + SLOT.size / 2;
    gsap.set("#mm-mark", { x: MARK.cx - MARK.size / 2, y: MARK.cy - MARK.size / 2 });
    gsap.set("#md-map", { x: MAP.cx - 200, y: MAP.cy - 433, scale: PHONE_SCALE });
    gsap.set("#md-list", { x: LIST.cx - 200, y: LIST.cy - 433, scale: PHONE_SCALE });
    const right = LIST.cx + 200 * PHONE_SCALE;
    CALLOUTS.forEach((c) => {
      const top = listY(c.from);
      const height = listY(c.to) - top;
      const el = $(c.sel);
      el.querySelector(".bracket").style.height = `${height}px`;
      gsap.set(el, { x: right + 34, y: top });
    });
  }

  function revealLine(seg, ctx, sel, at) {
    ctx.ft(seg, sel, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.95, ease: "power3.out" }, at);
  }

  const SCENE6 = [
    {
      id: "models",
      title: "Powered by Meta's Muse models",
      notes: "That's where Muse AI comes in. [On screen: Muse Ember for reasoning, writing and reading flyers; Muse Voice Transcribe for voice input.]",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        /* A soft Meta-blue sweep crosses the frame and leaves the mark behind it. */
        ctx.ft(seg, "#mm-sweep", { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.1);
        ctx.ft(seg, "#mm-sweep", { x: -1500 }, { x: 1920, duration: 1.7, ease: "power2.inOut" }, 0.1);
        ctx.sfx(seg, "whoosh", { dur: 1.2, level: 0.07, from: 300, to: 1600 }, 0.1);
        ctx.ft(seg, "#mm-mark", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out" }, 0.7);
        ctx.ft(seg, "#mm-mark", { scale: 0.5, rotation: -120 }, { scale: 1, rotation: 0, duration: 1.1, ease: "power3.out" }, 0.7);
        ctx.sfx(seg, "swell", { dur: 2.0, level: 0.05, notes: [392, 523.3, 659.3] }, 0.7);
        revealLine(seg, ctx, "#mm-title", 1.1);
        ["#mm-c1", "#mm-c2"].forEach((sel, i) => {
          const at = 1.6 + i * 0.16;
          ctx.ft(seg, sel, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, at);
          ctx.ft(seg, `${sel} .line`, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.inOut" }, at + 0.3);
        });
      },
      idle(api) {
        api.loop("#mm-mark img", { scale: 1.045, duration: 2.8 });
      },
    },
    {
      id: "discovery",
      title: "Personalized AI discovery",
      notes: "And for students, Muse AI helps surface the events that match their interests, location, and schedule.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        ctx.ft(seg, "#mm-title", { opacity: 1, y: 0 }, { opacity: 0, y: -36, duration: 0.45, ease: "power2.in" }, 0);
        ["#mm-c1", "#mm-c2"].forEach((sel, i) => {
          ctx.ft(seg, sel, { opacity: 1, y: 0 }, { opacity: 0, y: -36, duration: 0.45, ease: "power2.in" }, 0.04 + i * 0.05);
        });
        /* The mark carries over: it becomes the heading's mark. */
        const s = SLOT.size / MARK.size;
        ctx.ft(
          seg,
          "#mm-mark",
          { x: MARK.cx - MARK.size / 2, y: MARK.cy - MARK.size / 2, scale: 1 },
          { x: SLOT.cx - MARK.size / 2, y: SLOT.cy - MARK.size / 2, scale: s, duration: 0.95, ease: "power3.inOut" },
          0.1,
        );
        ctx.ft(seg, "#md-title", { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.75, ease: "power3.out" }, 0.62);
        ctx.ft(seg, "#md-map", { opacity: 0, y: MAP.cy - 433 + 640, rotation: -3 }, { opacity: 1, y: MAP.cy - 433, rotation: 0, duration: 1.05, ease: "power3.out" }, 0.35);
        ctx.ft(seg, "#md-list", { opacity: 0, y: LIST.cy - 433 + 700, rotation: 3 }, { opacity: 1, y: LIST.cy - 433, rotation: 0, duration: 1.05, ease: "power3.out" }, 0.47);
        ctx.sfx(seg, "whoosh", { dur: 0.8, level: 0.08, from: 400, to: 1800 }, 0.35);
        CALLOUTS.forEach((c, i) => {
          const at = 1.45 + i * 0.38;
          ctx.ft(seg, c.sel, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at);
          ctx.ft(seg, `${c.sel} .bracket`, { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power3.out" }, at);
          ctx.ft(seg, `${c.sel} span`, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, at + 0.12);
          ctx.sfx(seg, "tap", { f: 1400 + i * 240, level: 0.1 }, at);
        });
      },
      idle(api) {
        api.loop("#mm-mark img", { scale: 1.06, duration: 2.8 });
      },
    },
  ];

  const SCENE7 = [
    {
      id: "less-work",
      title: "Less work for organizers. Less searching for students.",
      notes: "Less work for organizers. Less searching for students.",
      build(seg, ctx) {
        /* Fade the interface to black rather than cut, then the two lines. */
        ctx.ft(seg, "#m6", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.6, ease: "power2.in" }, 0);
        ctx.ft(seg, "#m7", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.6);
        revealLine(seg, ctx, "#m7-a", 0.75);
        revealLine(seg, ctx, "#m7-b", 1.55);
      },
    },
    {
      id: "cast",
      title: "Meet the four people in the skit",
      notes: "But what does this actually look like in real life? [Rewrite for four: Jing, the organizer; Jolyn, a Facebook Events power user; Lisa, new to Facebook; Trish, new to Facebook Events.]",
      build(seg, ctx) {
        ctx.show(seg, "m7");
        /* A hard cut to the cast, like every other text change. */
        seg.set("#m7-pair", { opacity: 0 }, 0);
        const at = [0.35, 0.47, 0.6, 0.7];
        ["#c1", "#c2", "#c3", "#c4"].forEach((sel, i) => {
          ctx.ft(seg, sel, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, at[i]);
          ctx.ft(seg, `${sel} .rule`, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.inOut" }, at[i] + 0.3);
        });
        ctx.sfx(seg, "swell", { dur: 2.4, level: 0.06 }, 0.4);
      },
    },
  ];

  const STEPS = [...SCENE6, ...SCENE7];

  Deck.start({ id: "muse", steps: STEPS, prepare });
})();
