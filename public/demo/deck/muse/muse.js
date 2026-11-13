/* Muse deck: Jolyn's scenes 6 and 7, one entry per click. Same rules as the problem
   deck: every step sets its own start states, so any step can be cut from STEPS.
   Captures are on the demo clock 3:05 PM, so the story event reads 3:30 to 5:30 PM everywhere. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  const PHONE = { x: 760, y: 107 };
  const POST = { x: 210, y: 112 };
  const DRAFT = { x: 900, y: 120 };
  const K = 560 / 1080;
  /* Where the flyer sits inside the Instagram capture, in stage pixels, so it can lift out as one object. */
  const IN_PHONE = { x: 840, y: 222, scale: 239.4 / 560 };

  /* The app's draft fields with the values the app shows for this post, in the order they
     are printed on the flyer so no link crosses another. Regions: components/demo/moments/flyer-regions.ts. */
  const FIELDS = [
    { lab: "What it is", val: "Board Game Night", region: [70, 176, 850, 256] },
    { lab: "Free food", val: "Free dumplings while they last", region: [70, 456, 745, 92] },
    { lab: "When", val: "Today, 3:30 PM to 5:30 PM", region: [68, 930, 784, 130] },
    { lab: "Where", val: "MIT Museum, 314 Main St", region: [68, 1080, 640, 74] },
    { lab: "Who can come", val: "Open to everyone", region: [68, 1160, 810, 96] },
  ];

  function prepare() {
    const rows = $("#m-rows");
    const boxes = $("#m-boxes");
    const links = $("#m-links");
    FIELDS.forEach((f, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span class="num">${i + 1}</span><span class="num on">${i + 1}</span><div><p class="lab">${f.lab}</p><p class="val">${f.val}</p></div>`;
      rows.appendChild(row);
      const [x, y, w, h] = f.region;
      const box = document.createElement("div");
      box.className = "box";
      const pad = 3;
      Object.assign(box.style, { left: `${x * K - pad}px`, top: `${y * K - pad}px`, width: `${w * K + pad * 2}px`, height: `${h * K + pad * 2}px` });
      box.innerHTML = `<span class="n">${i + 1}</span>`;
      boxes.appendChild(box);
      f.row = row;
      f.box = box;
    });
    /* Links from each box to its row, in stage coordinates. */
    FIELDS.forEach((f) => {
      const [x, y, w, h] = f.region;
      const x1 = POST.x + (x + w) * K + 8;
      const y1 = POST.y + (y + h / 2) * K;
      const x2 = DRAFT.x + 18;
      const y2 = DRAFT.y + f.row.offsetTop + 41;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mid = (x1 + x2) / 2;
      path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
      path.setAttribute("pathLength", "1");
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = "1";
      links.appendChild(path);
      f.link = path;
    });
    gsap.set("#m-ig", { x: PHONE.x, y: PHONE.y });
    gsap.set("#m-tap1", { x: 200, y: 756 });
    gsap.set("#m-post", { x: IN_PHONE.x, y: IN_PHONE.y, scale: IN_PHONE.scale });
    gsap.set("#m-draft", { x: DRAFT.x, y: DRAFT.y });
    gsap.set("#m-review", { x: PHONE.x, y: PHONE.y });
    /* The review capture's "Post to Facebook Events" button, in phone pixels. */
    gsap.set("#m-tap2", { x: 200, y: 707 });
    gsap.set("#m-feed", { x: PHONE.x, y: PHONE.y });
  }

  function revealLine(seg, ctx, sel, at) {
    ctx.ft(seg, sel, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.95, ease: "power3.out" }, at);
  }

  function tap(seg, ctx, sel, at) {
    ctx.ft(seg, sel, { opacity: 0, scale: 0.3 }, { opacity: 0.9, scale: 1, duration: 0.22, ease: "power2.out" }, at);
    seg.to(sel, { opacity: 0, scale: 1.3, duration: 0.35, ease: "power1.out" }, at + 0.22);
    ctx.sfx(seg, "tap", { f: 1500, level: 0.14 }, at);
  }

  const SCENE6 = [
    {
      id: "instagram-post",
      title: "The club posts on Instagram, like always",
      notes: "But here's the challenge. Students aren't the only ones who don't want to do extra work. Event organizers don't either. They're already posting their events on Instagram. So why make them post everything twice?",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        ctx.ft(seg, "#m-ig", { opacity: 0, y: PHONE.y + 170, scale: 0.94 }, { opacity: 1, y: PHONE.y, scale: 1, duration: 1.15, ease: "power3.out" }, 0.15);
        ctx.sfx(seg, "whoosh", { dur: 0.8, level: 0.08, from: 500, to: 1800 }, 0.15);
      },
      idle(api) {
        api.loop("#m-ig .screen", { y: -6, duration: 3.4 });
      },
    },
    {
      id: "share-and-read",
      title: "One share, and Muse reads the post",
      notes: "That's where Muse AI comes in.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        tap(seg, ctx, "#m-tap1", 0.12);
        /* The flyer lifts straight out of the post: it starts exactly over the phone's flyer. */
        seg.set("#m-post", { opacity: 1, x: IN_PHONE.x, y: IN_PHONE.y, scale: IN_PHONE.scale }, 0.5);
        ctx.ft(seg, "#m-ig", { opacity: 1, x: PHONE.x, scale: 1 }, { opacity: 0, x: PHONE.x + 40, scale: 0.96, duration: 0.45, ease: "power2.in" }, 0.5);
        ctx.ft(seg, "#m-post", { x: IN_PHONE.x, y: IN_PHONE.y, scale: IN_PHONE.scale }, { x: POST.x, y: POST.y, scale: 1, duration: 1.05, ease: "power3.inOut" }, 0.55);
        ctx.ft(seg, "#m-caption", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.45);
        ctx.sfx(seg, "whoosh", { dur: 0.7, level: 0.09 }, 0.55);
        ctx.ft(seg, "#m-scan", { opacity: 0, x: POST.x - 40, y: POST.y - 10 }, { opacity: 1, duration: 0.2 }, 1.85);
        ctx.ft(seg, "#m-scan", { y: POST.y - 10 }, { y: 1010, duration: 1.7, ease: "power1.inOut" }, 1.9);
        seg.to("#m-scan", { opacity: 0, duration: 0.3 }, 3.5);
        ctx.sfx(seg, "scan", { dur: 1.7 }, 1.9);
        ctx.ft(seg, "#m-draft", { opacity: 0, x: DRAFT.x + 70 }, { opacity: 1, x: DRAFT.x, duration: 0.85, ease: "power3.out" }, 2.75);
      },
    },
    {
      id: "fields",
      title: "Muse fills in the event, field by field",
      notes: "With a single share, Muse AI reads the existing post, extracts the event details, and prepares a Facebook Event automatically.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        const at = [0.15, 0.6, 1.02, 1.4, 1.76];
        FIELDS.forEach((f, i) => {
          const t = at[i];
          ctx.ft(seg, f.box, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.28, ease: "power3.out" }, t);
          ctx.ft(seg, f.link, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.42, ease: "power2.inOut" }, t + 0.1);
          ctx.ft(seg, f.row.querySelector(".num.on"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, t + 0.42);
          ctx.ft(seg, f.row.querySelector(".val"), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, t + 0.45);
          ctx.sfx(seg, "tap", { f: 1300 + i * 140, level: 0.11 }, t + 0.45);
        });
      },
    },
    {
      id: "post-it",
      title: "The organizer confirms with one tap",
      notes: "Organizers simply confirm the details and choose how their event is promoted.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        /* The same draft, now in the app: the real review screen, Post, and the real posted event. */
        ctx.ft(seg, "#m-draft", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.92, duration: 0.5, ease: "power2.in" }, 0);
        ctx.ft(seg, "#m-post", { opacity: 1, x: POST.x }, { opacity: 0, x: POST.x - 80, duration: 0.5, ease: "power2.in" }, 0);
        ctx.ft(seg, "#m-links", { opacity: 1 }, { opacity: 0, duration: 0.3 }, 0);
        ctx.ft(seg, "#m-review", { opacity: 0, y: 1120 }, { opacity: 1, y: PHONE.y, duration: 1.0, ease: "power3.out" }, 0.25);
        ctx.sfx(seg, "whoosh", { dur: 0.7, level: 0.08, from: 400, to: 1600 }, 0.25);
        tap(seg, ctx, "#m-tap2", 1.5);
        ctx.ft(seg, "#m-posted-img", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power1.inOut" }, 1.8);
        ctx.sfx(seg, "swell", { dur: 1.8, level: 0.05, notes: [392, 493.9, 587.3] }, 1.8);
      },
      idle(api) {
        api.loop("#m-review .screen", { y: -6, duration: 3.4 });
      },
    },
    {
      id: "for-students",
      title: "For students: Muse puts it first",
      notes: "And for students, Muse AI helps surface the events that match their interests, location, and schedule.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        /* Same phone, new screen: the student's side of the same event. */
        ctx.ft(seg, "#m-feed", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.inOut" }, 0.1);
        ctx.ft(seg, "#m-review", { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "none" }, 0.45);
        ctx.sfx(seg, "whoosh", { dur: 0.5, level: 0.06, from: 600, to: 1800 }, 0.1);
        ctx.ft(seg, "#m-ring", { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, 1.25);
        ctx.sfx(seg, "tap", { f: 1500, level: 0.1 }, 1.25);
      },
      idle(api) {
        api.loop("#m-ring b", { opacity: 0.45, duration: 1.3 });
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
