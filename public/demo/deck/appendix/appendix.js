/* Appendix deck, hidden past the thank you: one "how we built it" slide, then the
   questions we expect, one slide each, with an index. Every word comes from content.json
   beside this file. On a question, number keys 1 to 9 jump to that question and 0 goes back
   to the index; a click on the index (or on "All questions") does the same. */
(async function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const icon = (name) => (window.DeckIcons || {})[name] || "";

  const content = await Deck.load("./content.json", { build: { stats: [] }, questions: [] });
  const build = content.build || { stats: [] };
  const questions = (content.questions || []).slice(0, 9);
  const PROOF = window.RECAP_PROOF || {};

  /* The real captures a question can show, from the decks' one capture pass. */
  const CAPTURES = { list: "list.jpg", map: "events-map.jpg", picks: "recap-5-picks.jpg", flyer: "recap-1-flyer.jpg", hello: "recap-6-hello.jpg" };
  const LIVE = ["Read the club's flyer", "Planned her walk home", "Heard what she said", "Re-planned, sent the invite", "Built her first feed", "Found people, wrote the hello"];
  const RECAP_KEYS = ["flyer", "walk", "heard", "replan", "picks", "hello"];
  const STAGED = ["Instagram screens", "Reels", "Lock screen alert", "Friend list"];

  function visualHtml(visual) {
    const [kind, name] = String(visual || "").split(":");
    if (kind === "capture" && CAPTURES[name]) {
      return `<div class="phone"><div class="screen"><img src="../shared/captures/${CAPTURES[name]}" alt="" /></div></div>`;
    }
    if (name === "instagram-to-facebook") {
      return `<div class="dg dg-flow">
        <div class="dg-step"><img src="../shared/brand/instagram-glyph.png" alt="Instagram" /><span>A club posts on Instagram</span></div>
        <div class="dg-down">${icon("arrow")}</div>
        <div class="dg-step"><img src="../shared/brand/meta-ai.png" alt="Meta AI" /><span>Muse reads the post</span></div>
        <div class="dg-down">${icon("arrow")}</div>
        <div class="dg-step"><img src="../shared/brand/facebook-f.svg" alt="Facebook" /><span>It shows up in Events</span></div>
      </div>`;
    }
    if (name === "meta-stack") {
      return `<div class="dg dg-flow">
        <div class="dg-step"><img src="../shared/brand/facebook-f.svg" alt="Facebook" /><span>Facebook Events</span></div>
        <div class="dg-step"><img src="../shared/brand/meta-ai.png" alt="Meta AI" /><span>Meta's Muse models</span></div>
        <div class="dg-step"><img src="../shared/brand/instagram-glyph.png" alt="Instagram" /><span>Instagram posts</span></div>
        <div class="dg-step"><div class="dg-ic">${icon("glasses")}</div><span>Ray-Ban Display, next</span></div>
      </div>`;
    }
    if (name === "opt-in") {
      return `<div class="dg">
        <div class="dg-card"><div class="dg-switch">Share my location<i></i></div><div class="dg-switch">Open to company<i></i></div></div>
        <p class="dg-note">Both off until you turn them on.</p>
      </div>`;
    }
    if (name === "live-vs-staged") {
      return `<div class="dg dg-cols">
        <div><h4>Live calls to Muse</h4><ul>${LIVE.map((t) => `<li>${icon("check")}${t}</li>`).join("")}</ul></div>
        <div class="staged"><h4>Staged for the demo</h4><ul>${STAGED.map((t) => `<li>${icon("grid")}${t}</li>`).join("")}</ul></div>
      </div>`;
    }
    if (name === "recap-times") {
      const max = Math.max(...RECAP_KEYS.map((k) => (PROOF[k] || {}).seconds || 0), 1);
      return `<div class="dg dg-times">${RECAP_KEYS.map((k, i) => {
        const s = (PROOF[k] || {}).seconds || 0;
        return `<div class="dg-time"><p>${LIVE[i]}</p><i style="width:${Math.round((s / max) * 100)}%"></i><b>${s.toFixed(1)} s</b></div>`;
      }).join("")}</div>`;
    }
    return "";
  }

  /* The scenes are built before the deck starts, so the runtime dresses their phones. */
  $("#b-title").textContent = build.title || "";
  $("#b-line").textContent = build.line || "";
  $("#b-asof").textContent = build.asOf ? `From git and the team's board, ${build.asOf}` : "";
  const stats = $("#b-stats");
  (build.stats || []).slice(0, 4).forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "b-stat";
    el.id = `b-s${i + 1}`;
    el.innerHTML = `<b>0</b><span></span>`;
    el.querySelector("span").textContent = s.label || "";
    stats.appendChild(el);
  });

  const FLOW = { people: 5, gap: 190, x0: 90, rowA: 42, rowB: 236, board: { x: 1190, y: 139 } };
  const flow = $("#b-flow");
  let links = "";
  for (let i = 0; i < FLOW.people; i++) {
    const cx = FLOW.x0 + i * FLOW.gap;
    flow.insertAdjacentHTML("beforeend", `<div class="b-node b-person" style="left:${cx - 42}px;top:${FLOW.rowA - 42}px">${icon("person")}</div>`);
    flow.insertAdjacentHTML("beforeend", `<div class="b-node b-agent" style="left:${cx - 42}px;top:${FLOW.rowB - 42}px">${icon("code")}</div>`);
    links += `<path class="b-link" d="M${cx} ${FLOW.rowA + 46} V${FLOW.rowB - 46}"/>`;
    links += `<path class="b-link" d="M${cx + 46} ${FLOW.rowB} C ${cx + 260} ${FLOW.rowB}, ${FLOW.board.x - 220} ${FLOW.board.y}, ${FLOW.board.x - 8} ${FLOW.board.y}"/>`;
  }
  flow.insertAdjacentHTML("afterbegin", `<svg class="links" width="1640" height="300" fill="none" stroke="#3b3f4a" stroke-width="3" stroke-linecap="round">${links}</svg>`);
  flow.insertAdjacentHTML("beforeend", `<div class="b-node b-board" style="left:${FLOW.board.x}px;top:${FLOW.board.y - 42}px">One shared board</div>`);

  $("#i-title").textContent = content.questionsTitle || "Questions";
  const grid = $("#i-grid");
  const cam = $("#cam");
  questions.forEach((q, i) => {
    const k = i + 1;
    const tile = document.createElement("div");
    tile.className = "i-item";
    tile.dataset.q = String(k);
    tile.innerHTML = `<b>${k}</b><span></span>`;
    tile.querySelector("span").textContent = q.q || "";
    grid.appendChild(tile);
    const scene = document.createElement("section");
    scene.className = "scene";
    scene.id = `q${k}`;
    scene.innerHTML = `<div class="q-left"><p class="q-num">Question ${k} of ${questions.length}</p><h2 class="q-q"></h2><p class="q-a"></p></div><div class="q-right">${visualHtml(q.visual)}</div>`;
    scene.querySelector(".q-q").textContent = q.q || "";
    scene.querySelector(".q-a").textContent = q.a || "";
    cam.appendChild(scene);
  });

  /* Count a stat up to its value with discrete sets, so a seek always shows the right number. */
  function countUp(seg, el, value, at) {
    const ticks = 16;
    const fmt = (v) => Math.round(v).toLocaleString("en-US");
    seg.set(el, { textContent: "0" }, 0);
    for (let i = 1; i <= ticks; i++) {
      const p = i / ticks;
      seg.set(el, { textContent: fmt(value * (1 - Math.pow(1 - p, 2.2))) }, at + 1.0 * p);
    }
  }

  const STEPS = [
    {
      id: "how-we-built-it",
      title: "Appendix: how we built it",
      lead: "speaker",
      notes: "Five people, their coding agents, one shared board. Numbers from git and the hub.",
      build(seg, ctx) {
        ctx.show(seg, "a1");
        ctx.ft(seg, "#b-title", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, 0.1);
        ctx.ft(seg, "#b-line", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, 0.3);
        $$("#b-flow .b-person").forEach((el, i) => ctx.ft(seg, el, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 0.6 + i * 0.08));
        $$("#b-flow .b-agent").forEach((el, i) => ctx.ft(seg, el, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 0.9 + i * 0.08));
        $$("#b-flow .b-link").forEach((path) => {
          const len = path.getTotalLength();
          path.style.strokeDasharray = `${len}`;
          ctx.ft(seg, path, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, 1.0);
        });
        ctx.ft(seg, "#b-flow .b-board", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, 1.5);
        $$(".b-stat").forEach((el, i) => {
          const at = 1.7 + i * 0.12;
          ctx.ft(seg, el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, at);
          countUp(seg, el.querySelector("b"), Number((build.stats[i] || {}).value) || 0, at);
        });
        ctx.ft(seg, "#b-asof", { opacity: 0 }, { opacity: 1, duration: 0.6 }, 2.6);
      },
    },
    {
      id: "questions",
      title: "Appendix: questions we expect",
      lead: "speaker",
      notes: "Click a question, or click the deck and press its number.",
      build(seg, ctx) {
        ctx.show(seg, "a2");
        ctx.leave(seg, "a1");
        ctx.ft(seg, "#i-title", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.1);
        $$(".i-item").forEach((el, i) => ctx.ft(seg, el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.3 + i * 0.06));
      },
    },
    ...questions.map((q, i) => ({
      id: `q-${i + 1}`,
      title: `Q${i + 1}: ${q.q}`,
      lead: "speaker",
      notes: q.q,
      build(seg, ctx) {
        const sel = `#q${i + 1}`;
        ctx.show(seg, `q${i + 1}`);
        /* Next from the slide before fades it out; a jump from the index lands on the rest. */
        ctx.leave(seg, i === 0 ? "a2" : `q${i}`);
        ctx.ft(seg, `${sel} .q-num`, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.05);
        ctx.ft(seg, `${sel} .q-q`, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.1);
        ctx.ft(seg, `${sel} .q-a`, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.35);
        ctx.ft(seg, `${sel} .q-right`, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, 0.25);
      },
    })),
  ];

  const deck = await Deck.start({ id: "appendix", steps: STEPS });
  const FIRST_Q = 2;
  $$(".i-item").forEach((tile) => tile.addEventListener("click", () => deck.goTo(FIRST_Q + Number(tile.dataset.q) - 1)));
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "0") deck.goTo(1);
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= questions.length) deck.goTo(FIRST_Q + Number(e.key) - 1);
  });
})();
