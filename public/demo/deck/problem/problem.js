/* Problem deck: Jolyn's scenes 1 to 5, one entry per click.
   Each step builds its own segment with explicit start states (fromTo), so any
   step or scene can be cut from STEPS without breaking the ones after it. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------- Scene 1: the hook ---------- */
  const S1 = {
    chars: [],
    caret: { h: 118, startX: 0, y1: 0 },
    cascade: [],
  };

  function prepareScene1() {
    const q = $("#s1-q");
    $$("#s1-q .q-line").forEach((line) => {
      const text = line.textContent;
      line.textContent = "";
      for (const c of text) {
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = c;
        line.appendChild(span);
      }
    });
    const lines = $$("#s1-q .q-line");
    const lineH = lines[0].offsetHeight;
    S1.chars = [];
    lines.forEach((line, li) => {
      Array.from(line.children).forEach((span) => {
        S1.chars.push({
          el: span,
          ch: span.textContent,
          line: li,
          left: span.offsetLeft,
          right: span.offsetLeft + span.offsetWidth,
          top: line.offsetTop + (lineH - S1.caret.h) / 2,
        });
      });
    });
    S1.caret.centerX = q.offsetWidth / 2 - 4;
    S1.caret.y1 = S1.chars[0].top;

    /* The cascade: dozens of unreadable bubbles that cover the frame. Skeleton
       lines and typing dots only; the three readable replies are the real ones. */
    const field = $("#s1-field");
    const rand = Deck.rng(1307);
    const cols = 9;
    const rows = 11;
    const cellW = 2200 / cols;
    const cellH = 1260 / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const N = 124;
    S1.cascade = [];
    for (let i = 0; i < N; i++) {
      const cell = cells[i % cells.length];
      const depthRoll = rand();
      const depth = depthRoll < 0.3 ? 2 : depthRoll < 0.68 ? 1 : 0;
      const kindRoll = rand();
      const kind = kindRoll < 0.26 ? "dots" : kindRoll < 0.68 ? "one" : "two";
      const width = kind === "dots" ? 200 : kind === "one" ? 280 + rand() * 240 : 360 + rand() * 240;
      const height = kind === "two" ? 122 : kind === "one" ? 82 : 96;
      const x = -140 + cell.c * cellW + (rand() - 0.5) * 110 + (cellW - width) / 2;
      const colShift = ((cell.c * 53) % 97) - 48;
      const y = -100 + cell.r * cellH + colShift + (rand() - 0.5) * 110 + (cellH - height) / 2;
      const el = document.createElement("div");
      el.className = `cb d${depth}`;
      el.style.zIndex = String((3 - depth) * 100 + i);
      let inner = "";
      if (kind === "dots") inner = '<div class="dots"><i></i><i></i><i></i></div>';
      else if (kind === "one") inner = `<b style="width:${Math.round(width - 80)}px"></b>`;
      else inner = `<b style="width:${Math.round(width - 80)}px"></b><b style="width:${Math.round((width - 80) * (0.45 + rand() * 0.4))}px"></b>`;
      el.innerHTML = `<div class="bubble" style="width:${Math.round(width)}px">${inner}</div>`;
      field.appendChild(el);
      /* Arrive from the nearest edge's direction, so they come from everywhere. */
      const cx = x + width / 2 - 960;
      const cy = y + height / 2 - 540;
      const len = Math.hypot(cx, cy) || 1;
      S1.cascade.push({
        el,
        x,
        y,
        depth,
        scale: [1, 0.9, 0.8][depth],
        dx: (cx / len) * 70,
        dy: (cy / len) * 70,
        /* Arrivals accelerate exponentially: about 2 per second rising to a flood. */
        t: 1.5 * Math.log(1 + (i + 1) / 3),
        pitch: [1047, 1175, 1319, 1568, 1760][Math.floor(rand() * 5)],
      });
    }
  }

  /* Quote layout, left and top of each bubble's box, in the 1920 x 1080 frame. Six real
     replies (facts.json): five ordinary bubbles, and the standout centered in placeQuotes. */
  const QUOTE_POS = {
    "#s1-r1": { x: 190, y: 372 },
    "#s1-r2": { x: 1120, y: 262 },
    "#s1-r3t": { x: 230, y: 700 },
    "#s1-r3": { x: 230, y: 640 },
    "#s1-r5": { x: 1110, y: 478 },
    "#s1-r6": { x: 1010, y: 790 },
    "#s1-r4": { x: 0, y: 0 },
  };

  function placeQuotes() {
    const big = $("#s1-r4");
    QUOTE_POS["#s1-r4"] = { x: Math.round((1920 - big.offsetWidth) / 2), y: Math.round((1080 - big.offsetHeight) / 2) - 10 };
    Object.entries(QUOTE_POS).forEach(([sel, p]) => {
      gsap.set(sel, { x: p.x, y: p.y });
    });
  }

  /* A bubble arrives: a small overshoot pop from its tail, the way messages land. */
  function popIn(seg, ctx, sel, at, from) {
    const p = QUOTE_POS[sel];
    ctx.ft(seg, sel, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "power1.out" }, at);
    ctx.ft(seg, sel, { x: p.x + (from.x || 0), y: p.y + (from.y || 0) }, { x: p.x, y: p.y, duration: 0.46, ease: "power3.out" }, at);
    ctx.ft(seg, sel, { scale: 0.85 }, { scale: 1.03, duration: 0.2, ease: "power2.out" }, at);
    seg.to(sel, { scale: 1, duration: 0.2, ease: "power1.inOut" }, at + 0.2);
  }

  function typeQuestion(seg, ctx, at) {
    const rand = Deck.rng(4242);
    let t = at;
    S1.chars.forEach((c, i) => {
      if (c.ch === "F" && i > 0) t += 0.24;
      seg.set(c.el, { opacity: 1 }, t);
      seg.set("#s1-caret", { x: c.right + 6, y: c.top }, t);
      if (c.ch !== " ") ctx.sfx(seg, "key", { v: rand() }, t);
      t += 0.052 + rand() * 0.042 + (c.ch === " " ? 0.03 : 0);
      const nextChar = S1.chars[i + 1];
      if (nextChar && nextChar.line !== c.line) {
        seg.set("#s1-caret", { x: nextChar.left - 14, y: nextChar.top }, t - 0.02);
        t += 0.08;
      }
    });
    return t;
  }

  const SCENE1 = [
    {
      id: "hook-caret",
      title: "Black, a caret waiting",
      lead: "speaker",
      notes: "We asked 50 Gen Z students one question.",
      build(seg, ctx) {
        ctx.show(seg, "s1");
        seg.set("#s1-caret", { x: S1.caret.centerX, y: S1.caret.y1 }, 0);
        ctx.ft(seg, "#s1-caret", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.inOut" }, 0.1);
      },
      idle(api) {
        api.loop("#s1-caret-blink", { opacity: 0, duration: 0.55, ease: "steps(1)" });
      },
    },
    {
      id: "hook-question",
      title: "We asked 50 Gen Z students",
      lead: "screen",
      notes: "Quiet. Let the question type out.",
      build(seg, ctx) {
        ctx.show(seg, "s1");
        ctx.ft(seg, "#s1-eyebrow", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, 0);
        ctx.ft(seg, "#s1-caret", { x: S1.caret.centerX, y: S1.caret.y1, opacity: 1 }, { x: S1.chars[0].left - 14, duration: 0.5, ease: "power2.inOut" }, 0.55);
        const typed = typeQuestion(seg, ctx, 1.1);
        /* Hold past the last character, so the rest frame always includes the question mark. */
        seg.to({}, { duration: 0.35 }, typed);
      },
      idle(api) {
        api.loop("#s1-caret-blink", { opacity: 0, duration: 0.55, ease: "steps(1)" });
      },
    },
    {
      id: "hook-replies",
      title: "The first replies",
      lead: "screen",
      notes: "Quiet. Let them read the replies.",
      build(seg, ctx) {
        ctx.show(seg, "s1");
        ctx.ft(seg, "#s1-caret", { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0);
        ctx.ft(seg, "#s1-eyebrow", { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.45, ease: "power2.in" }, 0);
        ctx.ft(seg, "#s1-head", { y: 0, scale: 1 }, { y: -150, scale: 0.5, duration: 0.9, ease: "power3.inOut" }, 0.05);
        popIn(seg, ctx, "#s1-r1", 0.85, { x: -48 });
        ctx.sfx(seg, "ding", { f: 1175 }, 0.85);
        popIn(seg, ctx, "#s1-r2", 1.95, { x: 48 });
        ctx.sfx(seg, "ding", { f: 1319 }, 1.95);
        /* Someone is typing, and then the laugh: the dots become the reply in the same spot. */
        popIn(seg, ctx, "#s1-r3t", 2.85, { x: -30, y: 30 });
        ctx.sfx(seg, "pop", { f: 600, level: 0.18 }, 2.85);
        $$("#s1-r3t .typing i").forEach((dot, k) => {
          ctx.ft(seg, dot, { y: 0, opacity: 1 }, { y: -9, opacity: 0.55, duration: 0.2, ease: "sine.inOut", repeat: 3, yoyo: true }, 3.0 + k * 0.12);
        });
        ctx.ft(seg, "#s1-r3t", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.86, duration: 0.14, ease: "power2.in" }, 3.95);
        popIn(seg, ctx, "#s1-r3", 4.05, { y: 20 });
        ctx.sfx(seg, "ding", { f: 880, decay: 0.7, level: 0.24 }, 4.05);
      },
      idle(api) {
        api.loop("#s1-r1 .bob", { y: -5, duration: 2.7 });
        api.loop("#s1-r2 .bob", { y: 5, duration: 3.2 });
        api.loop("#s1-r3 .bob", { y: -5, duration: 3.5 });
      },
    },
    {
      id: "hook-avalanche",
      title: "The replies pile up",
      lead: "screen",
      notes: "Quiet while it fills.",
      build(seg, ctx) {
        ctx.show(seg, "s1");
        /* Two more real replies land early, while there is still room to read them. */
        popIn(seg, ctx, "#s1-r5", 0.95, { x: 48 });
        ctx.sfx(seg, "ding", { f: 1245, level: 0.2 }, 0.95);
        popIn(seg, ctx, "#s1-r6", 2.05, { x: 40, y: 30 });
        ctx.sfx(seg, "ding", { f: 1397, level: 0.2 }, 2.05);
        let lastSound = -1;
        S1.cascade.forEach((b) => {
          const at = 0.25 + b.t;
          ctx.ft(seg, b.el, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, at);
          ctx.ft(seg, b.el, { x: b.x + b.dx, y: b.y + b.dy }, { x: b.x, y: b.y, duration: 0.42, ease: "power3.out" }, at);
          ctx.ft(seg, b.el, { scale: b.scale * 0.82 }, { scale: b.scale * 1.03, duration: 0.18, ease: "power2.out" }, at);
          seg.to(b.el, { scale: b.scale, duration: 0.18, ease: "power1.inOut" }, at + 0.18);
          if (at - lastSound > 0.045) {
            ctx.sfx(seg, "ding", { f: b.pitch, level: 0.13, decay: 0.3 }, at);
            lastSound = at;
          }
        });
        const end = 0.25 + S1.cascade[S1.cascade.length - 1].t;
        ctx.ft(seg, "#s1-head", { opacity: 1 }, { opacity: 0.22, duration: 1.6, ease: "power1.inOut" }, 0.4);
        ctx.ft(seg, "#s1-shot", { scale: 1 }, { scale: 1.08, duration: 2.0, ease: "power2.inOut" }, end - 1.5);
      },
    },
    {
      id: "hook-standout",
      title: "If it helped me get more things done",
      lead: "screen",
      notes: "Quiet. Let them read the reply that led us here.",
      build(seg, ctx) {
        ctx.show(seg, "s1");
        /* Every other reply steps back; the one that led to the idea comes forward. */
        ctx.ft(seg, "#s1-veil", { opacity: 0 }, { opacity: 0.9, duration: 0.7, ease: "power2.inOut" }, 0);
        ctx.ft(seg, "#s1-shot", { scale: 1.08 }, { scale: 1.11, duration: 1.6, ease: "power2.out" }, 0);
        const p = QUOTE_POS["#s1-r4"];
        ctx.ft(seg, "#s1-r4", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.35);
        ctx.ft(seg, "#s1-r4", { x: p.x, y: p.y + 44, scale: 0.86 }, { y: p.y, scale: 1.03, duration: 0.36, ease: "power3.out" }, 0.35);
        seg.to("#s1-r4", { scale: 1, duration: 0.3, ease: "power1.inOut" }, 0.71);
        ctx.sfx(seg, "ding", { f: 988, decay: 0.7, level: 0.26 }, 0.35);
        /* The words Marketplace answers next, underlined the way "DO." will be. */
        ctx.ft(seg, "#s1-underline", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, 1.3);
        ctx.sfx(seg, "whoosh", { dur: 0.35, level: 0.06, from: 900, to: 3200 }, 1.3);
      },
      idle(api) {
        api.loop("#s1-r4 .bob", { y: -6, duration: 3.4 });
      },
    },
  ];

  /* ---------- Scene 2: Marketplace ---------- */
  /* Card positions (left, top, resting tilt) around the space the word will take. */
  const LISTINGS = [
    { sel: "#s2-l1", x: 170, y: 62, r: -7, dx: -120 },
    { sel: "#s2-l2", x: 1420, y: 84, r: 6, dx: 120 },
    { sel: "#s2-l3", x: 128, y: 606, r: 5, dx: -120 },
    { sel: "#s2-l4", x: 1470, y: 596, r: -5, dx: 120 },
    { sel: "#s2-l5", x: 796, y: -96, r: 3, dx: 0 },
  ];
  const S2 = { pairOffset: 0 };

  /* Wrap each word of a statement so it can rise on its own; nested spans stay whole. */
  function splitWords(el) {
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else {
            const w = document.createElement("span");
            w.className = "w";
            w.textContent = part;
            frag.appendChild(w);
          }
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1) {
        node.classList.add("w");
      }
    });
    return Array.from(el.querySelectorAll(":scope > .w"));
  }

  function prepareScene2() {
    ["#s2-a", "#s2-b"].forEach((sel) => splitWords($(sel)));
    S2.pairOffset = ($("#s2-b").offsetHeight + 34) / 2;
    LISTINGS.forEach((l) => gsap.set(l.sel, { x: l.x, y: l.y, rotation: l.r }));
    const word = $("#s2-word");
    const total = 225 + LOCK.gap + word.offsetWidth;
    LOCK.markX = (1920 - total) / 2;
    LOCK.wordX = LOCK.markX + 225 + LOCK.gap;
    LOCK.wordY = 540 - word.offsetHeight / 2 + 4;
    gsap.set("#s2-mark", { x: 960 - 112.5, y: LOCK.markY });
    gsap.set("#s2-word", { x: LOCK.wordX, y: LOCK.wordY });
  }

  /* Words rise into place; the stagger eases so it reads as one gesture, not a metronome. */
  function riseWords(seg, ctx, sel, at, dur) {
    const words = $$(`${sel} > .w`);
    ctx.ft(seg, sel, { opacity: 0 }, { opacity: 1, duration: 0.01 }, at);
    /* Every word starts hidden with the line, or a late word would show early and then pop. */
    seg.set(words, { opacity: 0, y: 46 }, at);
    words.forEach((w, i) => {
      const delay = at + 0.5 * Math.pow(i / Math.max(words.length - 1, 1), 0.85);
      ctx.ft(seg, w, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: dur || 0.85, ease: "power3.out" }, delay);
    });
  }

  /* The Marketplace lockup: the real mark at its own 225 px, the word beside it. Set in prepareScene2. */
  const LOCK = { markX: 0, wordX: 0, markY: 540 - 112.5, wordY: 0, gap: 48 };
  const WORD_HIDDEN = "inset(0% 100% 0% 0%)";
  const WORD_SHOWN = "inset(0% 0% 0% 0%)";

  const SCENE2 = [
    {
      id: "exception",
      title: "But there was one exception",
      lead: "speaker",
      notes: "But there was one exception.",
      build(seg, ctx) {
        ctx.show(seg, "s2");
        /* The hand-off: the noise cuts to black, the standout holds alone for a beat, then
           lifts away as the exception arrives in its place. */
        seg.set("#s1", { autoAlpha: 1 }, 0);
        ctx.hush(seg, 0.01);
        ctx.ft(seg, "#s1-veil", { opacity: 0.9 }, { opacity: 1, duration: 0.12, ease: "none" }, 0);
        ctx.ft(seg, "#s1-r4", { opacity: 1, y: QUOTE_POS["#s1-r4"].y }, { opacity: 0, y: QUOTE_POS["#s1-r4"].y - 60, duration: 0.55, ease: "power2.in" }, 0.6);
        seg.set("#s1", { autoAlpha: 0 }, 1.2);
        ctx.ft(seg, "#s2-line", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.5, ease: "power2.out" }, 1.0);
      },
    },
    {
      id: "marketplace",
      title: "Marketplace",
      lead: "screen",
      notes: "Let it land. Then: 'Facebook Marketplace. We go there to get things done.'",
      build(seg, ctx) {
        ctx.show(seg, "s2");
        ctx.ft(seg, "#s2-line", { opacity: 1 }, { opacity: 0, duration: 0.35, ease: "power1.in" }, 0);
        const delays = [0.08, 0.2, 0.27, 0.4, 0.46];
        LISTINGS.forEach((l, i) => {
          const d = delays[i];
          ctx.ft(seg, l.sel, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.out" }, d);
          ctx.ft(seg, l.sel, { x: l.x + l.dx, y: l.y + 110, rotation: l.r * 2.4, scale: 0.84 }, { x: l.x, y: l.y, rotation: l.r, scale: 1, duration: 1.05, ease: "power3.out" }, d);
        });
        ctx.sfx(seg, "whoosh", { dur: 0.7, level: 0.12 }, 0.08);
        /* The real mark lands in the center at its own size (never above it), then slides
           left as the word wipes in beside it. */
        ctx.ft(seg, "#s2-mark", { opacity: 0, x: 960 - 112.5, y: LOCK.markY, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.5, ease: "expo.out" }, 0.95);
        ctx.ft(seg, "#s2-mark", { x: 960 - 112.5 }, { x: LOCK.markX, duration: 0.75, ease: "power3.inOut" }, 1.55);
        ctx.ft(seg, "#s2-word", { opacity: 1, x: LOCK.wordX - 40, y: LOCK.wordY, clipPath: WORD_HIDDEN }, { x: LOCK.wordX, clipPath: WORD_SHOWN, duration: 0.75, ease: "power3.inOut" }, 1.62);
        ctx.sfx(seg, "impact", { level: 0.9 }, 1.05);
        ctx.ft(seg, "#cam", { scale: 1.02 }, { scale: 1, duration: 0.6, ease: "power2.out" }, 1.05);
        /* The cards give the lockup room: they dim and drift outward on impact. */
        LISTINGS.forEach((l) => {
          ctx.ft(seg, l.sel, { opacity: 1, x: l.x, y: l.y }, { opacity: 0.24, x: l.x + l.dx * 0.6, y: l.y + (l.y > 400 ? 70 : -70), duration: 0.9, ease: "power3.out" }, 1.0);
        });
      },
      idle(api) {
        LISTINGS.forEach((l, i) => api.loop(`${l.sel} .bob`, { y: i % 2 ? 7 : -7, rotation: i % 2 ? 0.8 : -0.8, duration: 3 + i * 0.37 }));
      },
    },
    {
      id: "app-to-scroll",
      title: "It's not just an app to scroll",
      lead: "screen",
      notes: "Quiet. Let them read.",
      build(seg, ctx) {
        ctx.show(seg, "s2");
        ctx.ft(seg, "#s2-mark", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9, duration: 0.4, ease: "power2.in" }, 0);
        ctx.ft(seg, "#s2-word", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.96, duration: 0.4, ease: "power2.in" }, 0);
        LISTINGS.forEach((l) => {
          ctx.ft(seg, l.sel, { opacity: 0.24, x: l.x + l.dx * 0.6, y: l.y + (l.y > 400 ? 70 : -70) }, { opacity: 0, x: l.x + l.dx * 1.6, y: l.y + (l.y > 400 ? 170 : -170), duration: 0.55, ease: "power2.in" }, 0.02);
        });
        seg.set("#s2-a", { y: S2.pairOffset }, 0);
        riseWords(seg, ctx, "#s2-a", 0.55);
      },
    },
    {
      id: "app-to-do",
      title: "It's an app to DO",
      lead: "screen",
      notes: "Let it land. Then: 'So what else could Facebook help us do?'",
      build(seg, ctx) {
        ctx.show(seg, "s2");
        ctx.ft(seg, "#s2-a", { y: S2.pairOffset, opacity: 1, color: "#ffffff" }, { y: 0, opacity: 0.6, color: "#a2a7b3", duration: 0.75, ease: "power3.inOut" }, 0);
        riseWords(seg, ctx, "#s2-b", 0.3);
        ctx.ft(seg, "#s2-underline", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, 1.15);
        ctx.sfx(seg, "whoosh", { dur: 0.35, level: 0.07, from: 900, to: 3200 }, 1.15);
      },
    },
  ];

  /* ---------- Scenes 3 and 4: campus flyers, the pile, the missed event ---------- */
  /* The team's seeded flyers (data/seed). cx, cy: center; w: width; r: tilt. */
  const FLYERS = [
    { key: "study", file: "evt-test-night-simmons-study-break", cx: 205, cy: 160, w: 310, r: -6 },
    { key: "hack", file: "evt-test-demo-stata-hack-info", cx: 720, cy: 140, w: 300, r: -3 },
    { key: "boulder", file: "evt-test-demo-z-center-bouldering", cx: 1205, cy: 120, w: 300, r: 3 },
    { key: "anime", file: "evt-test-night-central-anime", cx: 1715, cy: 175, w: 320, r: 6 },
    { key: "tacos", file: "evt-test-demo-central-tacos", cx: 250, cy: 885, w: 330, r: 3 },
    { key: "shirts", file: "evt-test-demo-killian-tshirts", cx: 695, cy: 925, w: 320, r: -4 },
    { key: "pancakes", file: "evt-test-night-baker-pancakes", cx: 1205, cy: 935, w: 330, r: 5 },
    { key: "midnight", file: "evt-test-night-w20-midnight-pizza", cx: 1690, cy: 865, w: 330, r: -3 },
    { key: "tea", file: "evt-mad-tea-party", cx: 470, cy: 470, w: 500, r: -5, ratio: 427 / 640 },
    { key: "boba", file: "evt-test-demo-kendall-boba", cx: 1450, cy: 480, w: 390, r: 4 },
    { key: "pizza", file: "evt-test-demo-stata-pizza", cx: 960, cy: 545, w: 430, r: -2 },
  ];
  const FLY = {};
  /* The one that gets buried: it really says 3 PM and free food. */
  const BURIED = { cx: 960, cy: 545, w: 430, r: -1.5 };
  const S3 = { pile: [] };

  const MAIL_ICON =
    "<svg viewBox='0 0 32 32' fill='none' stroke='#c9d4e6' stroke-width='2.4' stroke-linejoin='round'><rect x='4' y='7' width='24' height='18' rx='3'/><path d='M5 9 L16 17 L27 9'/></svg>";
  /* Senders and subjects come from the seeded events; everything else is unreadable skeleton. */
  const MAIL = [
    ["MIT Student Activities Office", "Midnight Pizza in the Student Center"],
    ["EECS Undergraduate Office", "Pizza Study Break at Stata"],
    ["Kendall Square Association", "Free Bagels at Kendall"],
    ["MIT Class Councils", "Killian Court Photo Day, Free T-shirts"],
    ["Baker House", "Fresh Cookies at Baker House"],
    ["MIT Undergraduate Association", "Ice Cream in Lobby 10"],
    ["Sloan Entrepreneurship Club", "Coffee Chat With Founders"],
    ["MIT Chinese Students Club", "Dumpling Night in the Student Center"],
    ["MIT Hacking Club", "Lunch Talk: Building Hackathon Projects That Ship"],
    ["MIT Outing Club", "Intro to Bouldering"],
  ];
  const IG = [
    ["Kendall Square Association", "evt-test-demo-kendall-boba"],
    ["Central Square Film Club", "evt-test-night-central-anime"],
    ["MIT Outing Club", "evt-test-demo-z-center-bouldering"],
    ["Baker House", "evt-test-night-baker-pancakes"],
    ["Central Square Business Association", "evt-test-demo-central-tacos"],
  ];
  const TIMES = ["now", "1m", "2m", "5m", "12m", "1h", "3h"];

  function cardHtml(kind, k, rand) {
    const time = TIMES[k % TIMES.length];
    if (kind === "email") {
      const [from, subject] = MAIL[k % MAIL.length];
      return `<div class="nt-ico">${MAIL_ICON}</div><div class="nt-body"><div class="nt-top"><b>${from}</b><time>${time}</time></div><div class="nt-sub">${subject}</div><i class="sk" style="width:${70 + Math.round(rand() * 25)}%"></i></div>`;
    }
    if (kind === "ig") {
      const [who, file] = IG[k % IG.length];
      return `<div class="ig-head"><img src="../shared/brand/instagram-glyph.png" alt="" /><span>${who}</span></div><img class="ig-pic" src="../shared/flyers/${file}.jpg" alt="" /><i class="sk" style="width:60%"></i>`;
    }
    if (kind === "chat") {
      return `<div class="nt-top"><b>Group chat</b><time>${time}</time></div><div class="chat-b"><i class="sk" style="width:${150 + Math.round(rand() * 90)}px"></i></div><div class="chat-b me"><i class="sk" style="width:${110 + Math.round(rand() * 80)}px"></i></div><div class="chat-b"><i class="sk" style="width:${90 + Math.round(rand() * 120)}px"></i></div>`;
    }
    const hue = Math.round(rand() * 360);
    return `<div class="ch-av" style="background:hsl(${hue} 45% 52%)"></div><div class="nt-body"><div class="nt-top"><b># events</b><time>${time}</time></div><i class="sk" style="width:92%"></i><i class="sk" style="width:${55 + Math.round(rand() * 30)}%"></i></div>`;
  }

  function prepareScene3() {
    const layer = $("#s3-flyers");
    FLYERS.forEach((f) => {
      const el = document.createElement("div");
      el.className = "flyer";
      el.id = `s3-f-${f.key}`;
      el.style.width = `${f.w}px`;
      el.innerHTML = `<div class="bob"><img src="../shared/flyers/${f.file}.jpg" alt="" /></div>`;
      layer.appendChild(el);
      f.h = f.w * (f.ratio || 1);
      f.el = el;
      FLY[f.key] = f;
      gsap.set(el, { x: f.cx - f.w / 2, y: f.cy - f.h / 2, rotation: f.r });
    });
    gsap.set("#s3-hero", { x: 960 - 320, y: BURIED.cy - 320, scale: (BURIED.w / 640) * 1.045, rotation: BURIED.r });

    /* The pile. The first three are placed by the script; the rest accelerate and bury the center. */
    const pile = $("#s3-pile");
    const rand = Deck.rng(2026);
    const scripted = [
      { kind: "email", x: 1230, y: 110, w: 620, from: { x: 360, y: -120 } },
      { kind: "email", x: 40, y: 500, w: 600, from: { x: -380, y: 0 } },
      { kind: "ig", x: 1300, y: 420, w: 360, from: { x: 120, y: 160 } },
    ];
    const N = 40;
    const kinds = ["email", "email", "ig", "chat", "email", "channel", "email", "chat", "ig", "email", "channel"];
    S3.pile = [];
    for (let i = 0; i < N; i++) {
      const s = scripted[i];
      const kind = s ? s.kind : kinds[i % kinds.length];
      const w = s ? s.w : kind === "ig" ? 320 + rand() * 60 : kind === "chat" ? 400 + rand() * 80 : 520 + rand() * 100;
      const late = i >= N - 12;
      let x;
      let y;
      if (s) {
        x = s.x;
        y = s.y;
      } else if (late) {
        x = 960 - w / 2 + (rand() - 0.5) * 520;
        y = 545 - 110 + (rand() - 0.5) * 520;
      } else {
        x = -120 + rand() * (2040 - w);
        y = -80 + rand() * 1000;
      }
      const el = document.createElement("div");
      el.className = `nt ${kind}`;
      el.style.width = `${Math.round(w)}px`;
      el.innerHTML = cardHtml(kind, i, rand);
      pile.appendChild(el);
      const cx = x + w / 2 - 960;
      const cy = y + 80 - 540;
      const len = Math.hypot(cx, cy) || 1;
      S3.pile.push({
        el,
        kind,
        x,
        y,
        r: (rand() - 0.5) * 7,
        from: s ? s.from : { x: (cx / len) * 160, y: (cy / len) * 160 },
        t: i < 3 ? [0.15, 0.7, 1.15][i] : 1.75 + 1.25 * Math.log(1 + (i - 2) / 3),
      });
    }
  }

  function revealLine(seg, ctx, sel, at) {
    ctx.ft(seg, sel, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.95, ease: "power3.out" }, at);
  }

  const SCENE3 = [
    {
      id: "flyers",
      title: "Campus is full of free food and events",
      lead: "speaker",
      notes: "Every day, clubs host events and give away free food. But it's scattered.",
      build(seg, ctx) {
        ctx.show(seg, "s3");
        const enter = (f, at, from, dur, ease) => {
          ctx.ft(seg, f.el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" }, at);
          ctx.ft(
            seg,
            f.el,
            { x: f.cx - f.w / 2 + (from.x || 0), y: f.cy - f.h / 2 + (from.y || 0), rotation: f.r + (from.r || 0), scale: from.s || 0.7 },
            { x: f.cx - f.w / 2, y: f.cy - f.h / 2, rotation: f.r, scale: 1, duration: dur, ease },
            at,
          );
          ctx.sfx(seg, "pop", { f: 420 + Math.round(at * 37) % 260, level: 0.22 }, at + 0.05);
        };
        enter(FLY.pizza, 0.1, { y: 300, r: -10, s: 0.62 }, 1.1, "power3.out");
        enter(FLY.boba, 1.0, { x: 560, r: 14, s: 0.8 }, 0.9, "power3.out");
        enter(FLY.tea, 1.32, { x: -560, r: -12, s: 0.8 }, 0.9, "power3.out");
        const ring = ["hack", "anime", "tacos", "boulder", "midnight", "study", "pancakes", "shirts"];
        const ringAt = [1.95, 2.14, 2.3, 2.47, 2.6, 2.73, 2.84, 2.94];
        ring.forEach((key, i) => {
          const f = FLY[key];
          const out = { x: (f.cx - 960) * 0.18, y: (f.cy - 540) * 0.18, r: f.r * 1.6, s: 0.6 };
          enter(f, ringAt[i], out, 0.75, "back.out(1.5)");
        });
      },
      idle(api) {
        FLYERS.forEach((f, i) => api.loop(`#s3-f-${f.key} .bob`, { y: i % 2 ? 6 : -6, rotation: i % 2 ? 0.6 : -0.6, duration: 2.8 + (i % 5) * 0.41 }));
      },
    },
    {
      id: "overload",
      title: "Scattered across emails, posts, and group chats",
      lead: "screen",
      notes: "Quiet. Let it pile up.",
      build(seg, ctx) {
        ctx.show(seg, "s3");
        let lastSound = -1;
        S3.pile.forEach((c, i) => {
          const at = c.t;
          ctx.ft(seg, c.el, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "none" }, at);
          ctx.ft(
            seg,
            c.el,
            { x: c.x + c.from.x, y: c.y + c.from.y, rotation: c.r * 2, scale: 0.92 },
            { x: c.x, y: c.y, rotation: c.r, scale: 1, duration: i < 3 ? 0.7 : 0.5, ease: "power3.out" },
            at,
          );
          if (at - lastSound > 0.07) {
            const name = c.kind === "chat" ? "ding" : c.kind === "ig" ? "tap" : "pop";
            ctx.sfx(seg, name, { f: name === "ding" ? 1319 : name === "tap" ? 1700 : 500, level: name === "ding" ? 0.12 : 0.16, decay: 0.3 }, at);
            lastSound = at;
          }
        });
        /* The free-food flyer surfaces in the middle, then sinks under the pile. */
        const h = FLY.hack;
        seg.set(h.el, { zIndex: 50 }, 1.45);
        ctx.ft(
          seg,
          h.el,
          { x: h.cx - h.w / 2, y: h.cy - h.h / 2, rotation: h.r, scale: 1 },
          { x: BURIED.cx - h.w / 2, y: BURIED.cy - h.h / 2, rotation: BURIED.r, scale: BURIED.w / h.w, duration: 0.7, ease: "power3.out" },
          1.45,
        );
        ctx.sfx(seg, "pop", { f: 700, level: 0.24 }, 1.5);
        ctx.ft(seg, "#s3-shot", { scale: 1, rotation: 0 }, { scale: 1.045, rotation: -0.7, duration: 4.6, ease: "power1.inOut" }, 0.1);
      },
    },
    {
      id: "buried",
      title: "Freeze on the buried flyer",
      lead: "speaker",
      notes: "And by the time we hear about something...",
      build(seg, ctx) {
        ctx.show(seg, "s3");
        ctx.hush(seg, 0.01);
        /* Darken, not blur: an animated blur over the whole pile stalls frames on a laptop. */
        ctx.ft(seg, "#s3-shot", { scale: 1.045 }, { scale: 1.14, duration: 1.7, ease: "power2.inOut" }, 0.05);
        ctx.ft(seg, "#s3-dim", { opacity: 0 }, { opacity: 1, duration: 1.1, ease: "power2.inOut" }, 0.05);
        const s0 = BURIED.w / 640;
        ctx.ft(seg, "#s3-hero", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power1.inOut" }, 0.2);
        ctx.ft(seg, "#s3-hero", { scale: s0 * 1.045, y: BURIED.cy - 320, rotation: BURIED.r }, { scale: 0.96, y: 540 - 320, rotation: 0, duration: 1.6, ease: "power3.inOut" }, 0.3);
      },
    },
    {
      id: "event-ended",
      title: "EVENT ENDED",
      lead: "screen",
      notes: "'...it's already over.' Then quiet.",
      build(seg, ctx) {
        ctx.show(seg, "s3");
        ctx.ft(seg, "#s3-stamp", { opacity: 0, scale: 2.3, rotation: -16 }, { opacity: 1, scale: 1, rotation: -16, duration: 0.2, ease: "power4.in" }, 0.08);
        ctx.ft(seg, "#s3-shade", { opacity: 0 }, { opacity: 0.45, duration: 0.35, ease: "power2.out" }, 0.28);
        ctx.ft(seg, "#s3-hero", { scale: 0.96 }, { scale: 0.94, duration: 0.07, ease: "power2.out" }, 0.28);
        seg.to("#s3-hero", { scale: 0.96, duration: 0.45, ease: "elastic.out(1, 0.5)" }, 0.35);
        ctx.ft(seg, "#cam", { x: 0 }, { x: 9, duration: 0.04, ease: "none", repeat: 3, yoyo: true }, 0.28);
        ctx.sfx(seg, "thud", { level: 0.7 }, 0.28);
        ctx.sfx(seg, "error", { level: 0.26 }, 0.3);
      },
    },
  ];

  const SCENE4 = [
    {
      id: "cant-find-them",
      title: "The opportunities exist. We just can't find them.",
      lead: "screen",
      notes: "Quiet. Then: 'Marketplace made Facebook useful for finding things.'",
      build(seg, ctx) {
        ctx.show(seg, "s4");
        ctx.hush(seg, 0.01);
        revealLine(seg, ctx, "#s4-a", 0.55);
        revealLine(seg, ctx, "#s4-b", 1.45);
        ctx.sfx(seg, "thud", { level: 0.35 }, 1.45);
      },
    },
  ];

  /* ---------- Scene 5: the solution ---------- */
  /* The three flyers Muse reads. Boxes are where each field sits on the flyer (640 px art);
     the extracted lines repeat what the flyer itself says. */
  const READ = [
    {
      key: "hack",
      file: "evt-test-demo-stata-hack-info",
      cx: 520,
      boxes: [[125, 165, 515, 325], [277, 340, 363, 374], [210, 380, 430, 410], [222, 425, 418, 473]],
      title: "Spring Hackathon Info Session",
      meta: "3 PM · Stata Center, 32-155",
      tag: "Free food",
      /* Lands where it really shows up: the third tile of the feed's Top 3. */
      to: [840, 372],
    },
    {
      key: "boulder",
      file: "evt-test-demo-z-center-bouldering",
      cx: 960,
      boxes: [[185, 193, 455, 295], [257, 315, 383, 345], [180, 355, 460, 380], [223, 398, 417, 446]],
      title: "Intro to Bouldering",
      meta: "3:30 PM · Z-Center Climbing Wall",
      tag: "Free swag",
      /* The middle tile of the same Top 3. */
      to: [716, 372],
    },
    {
      key: "pizza",
      file: "evt-test-demo-stata-pizza",
      cx: 1400,
      boxes: [[135, 190, 505, 295], [275, 312, 365, 345], [150, 352, 490, 382], [222, 398, 418, 446]],
      title: "Pizza Study Break at Stata",
      meta: "2 PM · Stata Center lobby",
      tag: "Free food",
      /* The map's walk home: Muse's first stop. */
      to: [1130, 679],
    },
  ];
  const ROW = { size: 380, top: 200 };
  /* Scattered first: the same flyers and notifications from before, then the noise drifts away. */
  const NOISE = [
    { kind: "flyer", file: "evt-test-demo-central-tacos", x: 90, y: 620, w: 300, r: -8 },
    { kind: "flyer", file: "evt-mad-tea-party", x: 1430, y: 690, w: 420, r: 6, ratio: 427 / 640 },
    { kind: "flyer", file: "evt-test-night-w20-midnight-pizza", x: 1560, y: 70, w: 290, r: 7 },
    { kind: "email", x: 60, y: 90, w: 560, r: -3 },
    { kind: "ig", x: 1080, y: 560, w: 320, r: 4 },
    { kind: "chat", x: 520, y: 760, w: 420, r: -2 },
  ];
  const SCATTER = { pizza: [1130, 160, 7], boulder: [610, 330, -9], hack: [880, 560, -5] };
  const S5 = { read: [], noise: [] };

  function prepareScene5() {
    const field = $("#s5-field");
    const rand = Deck.rng(77);
    NOISE.forEach((n, i) => {
      const el = document.createElement("div");
      if (n.kind === "flyer") {
        el.className = "flyer";
        el.style.width = `${n.w}px`;
        el.innerHTML = `<img src="../shared/flyers/${n.file}.jpg" alt="" />`;
      } else {
        el.className = `nt ${n.kind}`;
        el.style.width = `${n.w}px`;
        el.innerHTML = cardHtml(n.kind, i + 3, rand);
      }
      field.appendChild(el);
      S5.noise.push({ el, n });
    });
    READ.forEach((f) => {
      const el = document.createElement("div");
      el.className = "flyer hero";
      el.style.width = `${ROW.size}px`;
      el.innerHTML = `<img src="../shared/flyers/${f.file}.jpg" alt="" />`;
      const k = ROW.size / 640;
      f.boxEls = f.boxes.map(([x1, y1, x2, y2]) => {
        const b = document.createElement("div");
        b.className = "box";
        const pad = 4;
        Object.assign(b.style, { left: `${x1 * k - pad}px`, top: `${y1 * k - pad}px`, width: `${(x2 - x1) * k + pad * 2}px`, height: `${(y2 - y1) * k + pad * 2}px` });
        el.appendChild(b);
        return b;
      });
      field.appendChild(el);
      const card = document.createElement("div");
      card.className = "xcard";
      card.innerHTML = `<div class="xt">${f.title}</div><div class="xm">${f.meta}</div><span class="xf">${f.tag}</span>`;
      field.appendChild(card);
      const ping = document.createElement("div");
      ping.className = "ping";
      field.appendChild(ping);
      gsap.set(ping, { x: f.to[0] - 60, y: f.to[1] - 60 });
      f.el = el;
      f.card = card;
      f.ping = ping;
      S5.read.push(f);
    });
    S5.noise.forEach(({ el, n }) => gsap.set(el, { x: n.x, y: n.y, rotation: n.r }));
    S5.read.forEach((f) => {
      const [sx, sy, sr] = SCATTER[f.key];
      gsap.set(f.el, { x: sx, y: sy, rotation: sr });
    });
    gsap.set("#s5-lamp", { x: 620, y: 512 });
    gsap.set("#s5-flyer", { x: 990, y: 540 });
    gsap.set("#s5-feed", { x: 960 - 420 - 24, y: 107 });
    gsap.set("#s5-map", { x: 960 + 24, y: 107 });
  }

  const SCENE5 = [
    {
      id: "next-deal",
      title: "What if finding your next experience was as easy as finding your next deal?",
      lead: "screen",
      notes: "Quiet. Let them read the question.",
      build(seg, ctx) {
        ctx.show(seg, "s5");
        ctx.hush(seg, 0.01);
        /* The listing and the flyer slide in from opposite sides and meet: finding things, finding things to do. */
        ctx.ft(seg, "#s5-lamp", { opacity: 0, x: -420, rotation: -10 }, { opacity: 1, x: 620, rotation: -4, duration: 1.4, ease: "power3.out" }, 0.1);
        ctx.ft(seg, "#s5-flyer", { opacity: 0, x: 1960, rotation: 10 }, { opacity: 1, x: 990, rotation: 4, duration: 1.4, ease: "power3.out" }, 0.18);
        ctx.sfx(seg, "whoosh", { dur: 0.9, level: 0.1 }, 0.1);
        ctx.ft(seg, "#s5-q1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.55);
        ctx.ft(seg, "#s5-q2", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.8);
      },
      idle(api) {
        /* Idle loops only ever touch inner wrappers the timeline never animates. */
        api.loop("#s5-lamp .l-card", { y: -6, rotation: -0.6, duration: 3.1 });
        api.loop("#s5-flyer img", { y: 6, rotation: 0.6, duration: 3.5 });
      },
    },
    {
      id: "muse-organizes",
      title: "Muse turns posts into events",
      lead: "screen",
      notes: "Let it play. Then: 'Muse turns campus posts into personal, nearby plans.'",
      build(seg, ctx) {
        ctx.show(seg, "s5");
        ["#s5-q1", "#s5-q2"].forEach((sel, i) => ctx.ft(seg, sel, { opacity: 1, y: 0 }, { opacity: 0, y: -30, duration: 0.45, ease: "power2.in" }, i * 0.05));
        ctx.ft(seg, "#s5-lamp", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9, duration: 0.45, ease: "power2.in" }, 0.05);
        ctx.ft(seg, "#s5-flyer", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9, duration: 0.45, ease: "power2.in" }, 0.05);
                /* Chaos returns: everything scattered, slightly tilted. */
        const appear = [0.25, 0.32, 0.4, 0.44, 0.5, 0.55];
        S5.noise.forEach(({ el, n }, i) => {
          const h = n.kind === "flyer" ? n.w * (n.ratio || 1) : 160;
          ctx.ft(seg, el, { opacity: 0, x: n.x + (n.x < 900 ? -60 : 60), y: n.y, rotation: n.r * 1.6, scale: 0.9 }, { opacity: 1, x: n.x, rotation: n.r, scale: 1, duration: 0.6, ease: "power3.out" }, appear[i]);
          const out = n.x + n.w / 2 < 960 ? -1 : 1;
          ctx.ft(seg, el, { opacity: 1, x: n.x, y: n.y }, { opacity: 0, x: n.x + out * 260, y: n.y + (n.y + h / 2 < 540 ? -120 : 120), duration: 0.8, ease: "power2.in" }, 1.15 + i * 0.04);
        });
        S5.read.forEach((f, i) => {
          const [sx, sy, sr] = SCATTER[f.key];
          const rx = f.cx - ROW.size / 2;
          ctx.ft(seg, f.el, { opacity: 0, x: sx, y: sy, rotation: sr * 1.6, scale: 0.88 }, { opacity: 1, rotation: sr, scale: 1, duration: 0.6, ease: "power3.out" }, 0.28 + i * 0.07);
          /* Then into a clean row, in controlled paths. */
          ctx.ft(seg, f.el, { x: sx, y: sy, rotation: sr }, { x: rx, y: ROW.top, rotation: 0, duration: 1.1, ease: "power3.inOut" }, 1.05 + i * 0.05);
        });
        ctx.sfx(seg, "whoosh", { dur: 1.0, level: 0.08, from: 2000, to: 500 }, 1.05);
        /* Muse reads them: a scan passes, each field is boxed, the event comes out underneath. */
        const scanFrom = 290;
        const scanTo = 1630;
        const scanAt = 2.3;
        const scanDur = 1.7;
        ctx.ft(seg, "#s5-scan", { opacity: 0, x: scanFrom, y: ROW.top - 40 }, { opacity: 1, duration: 0.2 }, scanAt - 0.1);
        ctx.ft(seg, "#s5-scan", { x: scanFrom }, { x: scanTo, duration: scanDur, ease: "none" }, scanAt);
        seg.to("#s5-scan", { opacity: 0, duration: 0.25 }, scanAt + scanDur - 0.05);
        ctx.sfx(seg, "scan", { dur: scanDur }, scanAt);
        S5.read.forEach((f) => {
          const pass = scanAt + (scanDur * (f.cx - ROW.size / 2 - scanFrom)) / (scanTo - scanFrom);
          f.boxEls.forEach((b, k) => {
            ctx.ft(seg, b, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power3.out" }, pass + 0.12 + k * 0.09);
          });
          ctx.ft(seg, f.card, { opacity: 0, x: f.cx - 190, y: ROW.top + ROW.size + 70 }, { opacity: 1, y: ROW.top + ROW.size + 34, duration: 0.6, ease: "power3.out" }, pass + 0.45);
          ctx.sfx(seg, "tap", { f: 1500 + f.cx / 4, level: 0.09 }, pass + 0.45);
        });
        /* The phones rise, then each event flies to where it really appears: the feed or the map. */
        const land = 4.45;
        S5.read.forEach((f, i) => {
          ctx.ft(seg, f.card, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.7, duration: 0.45, ease: "power2.in" }, land - 0.1 + i * 0.03);
          f.boxEls.forEach((b) => ctx.ft(seg, b, { opacity: 1 }, { opacity: 0, duration: 0.3 }, land - 0.1));
          const fromX = f.cx - ROW.size / 2;
          const s1 = 0.2;
          ctx.ft(
            seg,
            f.el,
            { opacity: 1, scale: 1, x: fromX, y: ROW.top },
            { opacity: 0, scale: s1, x: f.to[0] - ROW.size / 2, y: f.to[1] - ROW.size / 2, duration: 0.95, ease: "power3.inOut" },
            land + 0.55 + i * 0.12,
          );
          ctx.ft(seg, f.ping, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, land + 1.35 + i * 0.12);
          seg.to(f.ping, { opacity: 0, scale: 1.6, duration: 0.5, ease: "power1.out" }, land + 1.65 + i * 0.12);
          ctx.sfx(seg, "tap", { f: 1400 + i * 180, level: 0.1 }, land + 1.35 + i * 0.12);
        });
        ctx.ft(seg, "#s5-feed", { opacity: 0, y: 1120, rotation: -3 }, { opacity: 1, y: 107, rotation: 0, duration: 1.0, ease: "power3.out" }, land);
        ctx.ft(seg, "#s5-map", { opacity: 0, y: 1180, rotation: 3 }, { opacity: 1, y: 107, rotation: 0, duration: 1.0, ease: "power3.out" }, land + 0.12);
        ctx.sfx(seg, "whoosh", { dur: 0.8, level: 0.1, from: 400, to: 1800 }, land);
        /* Then the payoff settles in: both phones push in together. */
        ctx.ft(seg, ["#s5-feed", "#s5-map"], { scale: 1 }, { scale: 1.07, duration: 1.3, ease: "power2.inOut" }, land + 1.9);
      },
      idle(api) {
        api.loop("#s5-feed .screen img", { y: -6, duration: 3.6 });
      },
    },
    {
      id: "events-reimagined",
      title: "Events, reimagined.",
      lead: "speaker",
      notes: "Facebook Events, reimagined, powered by Muse. No more missing out.",
      build(seg, ctx) {
        ctx.show(seg, "s5");
        ctx.ft(seg, "#s5-feed", { opacity: 1, scale: 1.07 }, { opacity: 0, scale: 1.5, duration: 0.6, ease: "power3.in" }, 0);
        ctx.ft(seg, "#s5-map", { opacity: 1, scale: 1.07 }, { opacity: 0, scale: 1.5, duration: 0.6, ease: "power3.in" }, 0);
        ctx.ft(seg, "#s5-fb", { opacity: 0, scale: 0.4, rotation: -20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: "back.out(1.7)" }, 0.62);
        ctx.ft(seg, "#s5-title", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.9, ease: "power3.out" }, 0.78);
        ctx.sfx(seg, "swell", { dur: 2.6, level: 0.08 }, 0.6);
      },
    },
  ];

  const STEPS = [...SCENE1, ...SCENE2, ...SCENE3, ...SCENE4, ...SCENE5];

  Deck.start({
    id: "problem",
    steps: STEPS,
    prepare() {
      prepareScene1();
      placeQuotes();
      prepareScene2();
      prepareScene3();
      prepareScene5();
    },
  });
})();
