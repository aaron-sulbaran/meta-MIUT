/* Next deck, after the recap: four or five future applications, then the thank you.
   Every word comes from content.json beside this file, so the text can change without
   touching the animation. Items fade in left to right, in the decks' motion language. */
(async function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const content = await Deck.load("./content.json", {
    heading: "What's next",
    futures: [],
    thanks: { title: "Thank you.", line: "", qr: true, tryLine: "", address: "" },
  });
  const items = (content.futures || []).slice(0, 5);
  const thanks = content.thanks || {};

  function prepare() {
    $("#n-heading").textContent = content.heading || "";
    const row = $("#n-row");
    row.style.gridTemplateColumns = `repeat(${Math.max(items.length, 1)}, 1fr)`;
    items.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "n-item";
      el.id = `n-i${i + 1}`;
      el.innerHTML = `<div class="n-icon">${(window.DeckIcons || {})[item.icon] || ""}</div><h3></h3><p></p><i class="n-rule"></i>`;
      el.querySelector("h3").textContent = item.title || "";
      el.querySelector("p").textContent = item.body || "";
      row.appendChild(el);
    });
    $("#n-title").textContent = thanks.title || "";
    $("#n-line").textContent = thanks.line || "";
    $("#n-try").textContent = thanks.tryLine || "";
    $("#n-addr").textContent = thanks.address || "";
    if (thanks.qr === false) $("#n-qr").style.display = "none";
  }

  const STEPS = [
    {
      id: "futures",
      title: "What's next",
      lead: "speaker",
      notes: "Breeze through them, left to right. Drafts marked in next/content.json.",
      build(seg, ctx) {
        ctx.show(seg, "n1");
        ctx.ft(seg, "#n-heading", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, 0.1);
        /* First, second, third, fourth, fifth: the same move, left to right. */
        $$(".n-item").forEach((el, i) => {
          const at = 0.45 + i * 0.24;
          ctx.ft(seg, el, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, at);
          ctx.ft(seg, el.querySelector(".n-icon"), { scale: 0.82 }, { scale: 1, duration: 0.7, ease: "back.out(1.7)" }, at);
          ctx.ft(seg, el.querySelector(".n-rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, at + 0.25);
        });
      },
      idle(api) {
        $$(".n-icon svg").forEach((svg, i) => api.loop(svg, { y: i % 2 ? 3 : -3, duration: 2.6 + i * 0.3 }));
      },
    },
    {
      id: "thank-you",
      title: "Thank you",
      lead: "speaker",
      notes: "Thank you. The code opens the live product.",
      build(seg, ctx) {
        ctx.show(seg, "n2");
        /* The row leaves the way it came, so the thank you lands on a clean frame. */
        seg.set("#n1", { autoAlpha: 1 }, 0);
        $$(".n-item").forEach((el, i) => {
          ctx.ft(seg, el, { opacity: 1, x: 0 }, { opacity: 0, x: 28, duration: 0.4, ease: "power2.in" }, i * 0.05);
        });
        ctx.ft(seg, "#n-heading", { opacity: 1 }, { opacity: 0, duration: 0.35, ease: "power2.in" }, 0);
        seg.set("#n1", { autoAlpha: 0 }, 0.65);
        ctx.ft(seg, "#n-fb", { opacity: 0, scale: 0.4, rotation: -20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: "back.out(1.7)" }, 0.6);
        ctx.ft(seg, "#n-title", { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.75);
        ctx.ft(seg, "#n-line", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 1.0);
        ctx.ft(seg, "#n-qr", { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }, 1.25);
      },
    },
  ];

  Deck.start({ id: "next", steps: STEPS, prepare });
})();
