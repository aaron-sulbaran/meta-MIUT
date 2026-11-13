/* Muse deck: Jolyn's scenes 6 and 7, one entry per click. Same rules as the problem
   deck: every step sets its own start states, so any step can be cut from STEPS. */
(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  const PHONE = { x: 760, y: 107 };
  const POST = { x: 210, y: 112 };
  const DRAFT = { x: 900, y: 92 };
  const K = 560 / 1080;

  /* The app's own five fields (components/organizer), filled from the story post.
     Regions are where each line is printed on the drawn flyer (components/demo/moments/flyer-regions.ts). */
  const FIELDS = [
    { lab: "What it is", val: "Board Game Night", src: "From the flyer", region: [70, 176, 850, 256] },
    { lab: "When", val: "Today, 7:00 PM to 9:00 PM", src: "From the flyer", region: [68, 930, 784, 130] },
    { lab: "Where", val: "MIT Museum, 314 Main St", src: "From the flyer", region: [68, 1080, 640, 74] },
    { lab: "Free food", val: "Dumplings", src: "From the flyer: “+ Free dumplings”", region: [70, 456, 745, 92] },
    { lab: "Who can come", val: "Open to everyone", src: "From the flyer", region: [68, 1160, 810, 96] },
  ];

  function prepare() {
    const rows = $("#m-rows");
    const boxes = $("#m-boxes");
    const links = $("#m-links");
    FIELDS.forEach((f, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span class="num">${i + 1}</span><span class="num on">${i + 1}</span><div><p class="lab">${f.lab}</p><p class="val">${f.val}</p><p class="src">${f.src}</p></div>`;
      rows.appendChild(row);
      const [x, y, w, h] = f.region;
      const box = document.createElement("div");
      box.className = "box";
      const pad = 6;
      Object.assign(box.style, { left: `${x * K - pad}px`, top: `${y * K - pad}px`, width: `${w * K + pad * 2}px`, height: `${h * K + pad * 2}px` });
      box.innerHTML = `<span class="n">${i + 1}</span>`;
      boxes.appendChild(box);
      f.row = row;
      f.box = box;
    });
    /* Links from each box on the flyer to its row in the draft, in stage coordinates. */
    FIELDS.forEach((f) => {
      const [x, y, w, h] = f.region;
      const x1 = POST.x + (x + w) * K + 8;
      const y1 = POST.y + (y + h / 2) * K;
      const x2 = DRAFT.x + 18;
      const y2 = DRAFT.y + f.row.offsetTop + f.row.offsetHeight / 2;
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
    gsap.set("#m-post", { x: POST.x, y: POST.y });
    gsap.set("#m-draft", { x: DRAFT.x, y: DRAFT.y });
    gsap.set("#m-posted", { x: PHONE.x, y: PHONE.y });
    gsap.set("#m-feed", { x: 960 - 420 - 24, y: PHONE.y });
    gsap.set("#m-map", { x: 960 + 24, y: PHONE.y });
    gsap.set(["#c1", "#c2", "#c3", "#c4"], { y: 0 });
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
        ctx.ft(seg, "#m-ig", { opacity: 1, x: PHONE.x, scale: 1 }, { opacity: 0, x: PHONE.x - 360, scale: 0.86, duration: 0.8, ease: "power3.inOut" }, 0.5);
        /* The flyer lifts out of the post and becomes the thing Muse reads. */
        ctx.ft(seg, "#m-post", { opacity: 0, x: PHONE.x - 60, y: PHONE.y + 60, scale: 0.5 }, { opacity: 1, x: POST.x, y: POST.y, scale: 1, duration: 1.0, ease: "power3.inOut" }, 0.55);
        ctx.sfx(seg, "whoosh", { dur: 0.7, level: 0.09 }, 0.55);
        ctx.ft(seg, "#m-scan", { opacity: 0, x: POST.x - 40, y: POST.y - 10 }, { opacity: 1, duration: 0.2 }, 1.7);
        ctx.ft(seg, "#m-scan", { y: POST.y - 10 }, { y: 1010, duration: 1.7, ease: "power1.inOut" }, 1.75);
        seg.to("#m-scan", { opacity: 0, duration: 0.3 }, 3.35);
        ctx.sfx(seg, "scan", { dur: 1.7 }, 1.75);
        ctx.ft(seg, "#m-draft", { opacity: 0, x: DRAFT.x + 70 }, { opacity: 1, x: DRAFT.x, duration: 0.85, ease: "power3.out" }, 2.6);
      },
    },
    {
      id: "fields",
      title: "Muse fills in the event, field by field",
      notes: "With a single share, Muse AI reads the existing post, extracts the event details, and prepares a Facebook Event automatically.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        const at = [0.15, 0.62, 1.05, 1.44, 1.8];
        FIELDS.forEach((f, i) => {
          const t = at[i];
          ctx.ft(seg, f.box, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.28, ease: "power3.out" }, t);
          ctx.ft(seg, f.link, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.42, ease: "power2.inOut" }, t + 0.1);
          ctx.ft(seg, f.row.querySelector(".num.on"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, t + 0.42);
          ctx.ft(seg, f.row.querySelector(".val"), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, t + 0.45);
          ctx.ft(seg, f.row.querySelector(".src"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, t + 0.6);
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
        ctx.ft(seg, "#m-postbtn", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 0.1);
        tap(seg, ctx, "#m-tap2", 0.75);
        ctx.ft(seg, "#m-draft", { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.92, duration: 0.5, ease: "power2.in" }, 1.15);
        ctx.ft(seg, "#m-post", { opacity: 1, x: POST.x }, { opacity: 0, x: POST.x - 80, duration: 0.5, ease: "power2.in" }, 1.15);
        ctx.ft(seg, "#m-links", { opacity: 1 }, { opacity: 0, duration: 0.3 }, 1.1);
        ctx.ft(seg, "#m-posted", { opacity: 0, y: 1120 }, { opacity: 1, y: PHONE.y, duration: 1.05, ease: "power3.out" }, 1.4);
        ctx.sfx(seg, "swell", { dur: 1.8, level: 0.05, notes: [392, 493.9, 587.3] }, 1.45);
      },
      idle(api) {
        api.loop("#m-posted .screen", { y: -6, duration: 3.4 });
      },
    },
    {
      id: "for-students",
      title: "For students: the feed and the map",
      notes: "And for students, Muse AI helps surface the events that match their interests, location, and schedule.",
      build(seg, ctx) {
        ctx.show(seg, "m6");
        ctx.ft(seg, "#m-posted", { opacity: 1, x: PHONE.x }, { opacity: 0, x: PHONE.x - 200, duration: 0.55, ease: "power2.in" }, 0);
        ctx.ft(seg, "#m-feed", { opacity: 0, y: 1120, rotation: -3 }, { opacity: 1, y: PHONE.y, rotation: 0, duration: 1.05, ease: "power3.out" }, 0.3);
        ctx.ft(seg, "#m-map", { opacity: 0, y: 1180, rotation: 3 }, { opacity: 1, y: PHONE.y, rotation: 0, duration: 1.05, ease: "power3.out" }, 0.44);
        ctx.sfx(seg, "whoosh", { dur: 0.8, level: 0.09, from: 400, to: 1800 }, 0.3);
        ctx.ft(seg, "#m-ring", { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, 1.45);
        ctx.ft(seg, "#m-ring2", { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, 1.8);
        ctx.sfx(seg, "tap", { f: 1400, level: 0.1 }, 1.45);
        ctx.sfx(seg, "tap", { f: 1700, level: 0.1 }, 1.8);
      },
      idle(api) {
        api.loop(["#m-ring b", "#m-ring2 b"], { opacity: 0.45, duration: 1.3 });
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
        ctx.ft(seg, "#m7-pair", { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.5, ease: "power2.in" }, 0);
        const at = [0.45, 0.55, 0.67, 0.77];
        ["#c1", "#c2", "#c3", "#c4"].forEach((sel, i) => {
          ctx.ft(seg, sel, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.95, ease: "power3.out" }, at[i]);
          ctx.ft(seg, `${sel} .bar`, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, at[i] + 0.55);
        });
        ctx.sfx(seg, "swell", { dur: 2.4, level: 0.06 }, 0.5);
      },
    },
  ];

  const STEPS = [...SCENE6, ...SCENE7];

  Deck.start({ id: "muse", steps: STEPS, prepare });
})();
