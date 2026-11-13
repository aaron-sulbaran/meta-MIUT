/* Opening decks runtime.
   One paused GSAP timeline per deck, one segment per step. A click plays the next
   segment at its designed timing, then the frame rests and stays alive (ambient
   drift plus each step's own idle) until the next click. Back and goto seek to a
   step's rest frame. Nothing advances on a timer.

   Host contract (same origin postMessage):
     stage to deck: {source: "demo-stage", type: "next" | "back"}, {type: "goto", step}
     deck to stage: {source: "demo-deck", type: "ready", steps}, {type: "step", index, steps},
                    {type: "end"} on next past the last step, {type: "start"} on back before the first.
   Keys, alone or embedded: ArrowRight, PageDown, Space go next; ArrowLeft, PageUp go back; M toggles sound.
   Each step says who leads it: "screen" (the room watches, the presenter is quiet, effects
   allowed) or "speaker" (the presenter talks, a calm picture, no effects).
   Review params: ?step=N opens at step N's rest, ?at=S freezes the timeline at S seconds,
   ?render=1 disables live behaviour (no drift, no idle) for frame capture. */
(function () {
  "use strict";
  const W = 1920;
  const H = 1080;
  const params = new URLSearchParams(location.search);
  const embedded = window.parent !== window;
  const mode = params.has("at") ? "frame" : params.has("render") ? "render" : "live";
  const live = mode === "live";

  /* Deterministic randomness so every run, render and review sees the same layout. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fit() {
    const el = document.getElementById("fit");
    if (!el) return;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const x = (window.innerWidth - W * s) / 2;
    const y = (window.innerHeight - H * s) / 2;
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }

  function post(message) {
    if (!embedded) return;
    try {
      window.parent.postMessage(Object.assign({ source: "demo-deck" }, message), window.location.origin);
    } catch (e) {
      /* a cross-origin parent: nothing to tell */
    }
  }

  function toast(text) {
    const el = document.getElementById("toast");
    if (!el || !window.gsap) return;
    el.textContent = text;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    gsap.to(el, { opacity: 0, duration: 0.5, delay: 1.2 });
  }

  function sfx(name, opts) {
    if (window.DeckSound) window.DeckSound.play(name, opts);
  }

  /* Every phone gets the stage phone's chrome: the screen's content moves into the app area
     below a status bar (the demo clock's 3:05), with the home indicator over the bottom. */
  const STATUS_ICONS =
    '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M1.2 4.4a10 10 0 0 1 13.6 0"/><path d="M3.6 7a6.4 6.4 0 0 1 8.8 0"/><path d="M8 11.2 6 9.3a2.9 2.9 0 0 1 4 0Z" fill="currentColor" stroke="none"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" stroke-opacity="0.4"/><rect x="2" y="2" width="17" height="9" rx="2.4" fill="currentColor"/><path d="M25 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z" fill="currentColor" fill-opacity="0.45"/></svg>';

  function dressPhones() {
    document.querySelectorAll(".phone .screen").forEach((screen) => {
      if (screen.querySelector(":scope > .app")) return;
      const app = document.createElement("div");
      app.className = "app";
      while (screen.firstChild) app.appendChild(screen.firstChild);
      screen.appendChild(app);
      const bar = document.createElement("div");
      bar.className = "sb";
      bar.setAttribute("aria-hidden", "true");
      bar.innerHTML = `<time>3:05</time><span>${STATUS_ICONS}</span>`;
      screen.appendChild(bar);
      const home = document.createElement("i");
      home.className = "home";
      screen.appendChild(home);
    });
  }

  async function settleAssets() {
    try {
      await document.fonts.ready;
    } catch (e) {
      /* fonts fall back */
    }
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => null) : null)));
  }

  /* Build helpers handed to every step. */
  function makeCtx(scenes) {
    return {
      W,
      H,
      rng,
      /* Show one scene, hide every other, at the segment's start. */
      show(seg, sceneId) {
        scenes.forEach((s) => {
          seg.set(s, { autoAlpha: s.id === sceneId ? 1 : 0 }, 0);
        });
      },
      /* A fromTo that never renders early, so many steps can own the same element over time. */
      ft(seg, target, from, to, at) {
        /* A key given only in `from` is held for the whole tween (GSAP would ignore it). */
        const vars = Object.assign({ immediateRender: false }, to);
        Object.keys(from).forEach((k) => {
          if (!(k in vars)) vars[k] = from[k];
        });
        seg.fromTo(target, from, vars, at);
      },
      /* Sound at a time inside the segment; ignored while seeking. Never under the
         presenter's voice: a step led by the speaker plays no effects. */
      lead: "screen",
      sfx(seg, name, opts, at) {
        if (this.lead === "speaker") return;
        seg.call(sfx, [name, opts], Math.max(0.02, at || 0));
      },
      hush(seg, at) {
        seg.call(() => window.DeckSound && window.DeckSound.hush(), [], Math.max(0.01, at || 0));
      },
    };
  }

  function createDeck(config) {
    const id = config.id;
    const steps = config.steps;
    const hold = config.hold == null ? 1.8 : config.hold;
    const scenes = Array.from(document.querySelectorAll(".scene"));
    const ctx = makeCtx(scenes);
    const tl = gsap.timeline({ paused: true });
    const marks = [];
    let t = 0;
    steps.forEach((step) => {
      const seg = gsap.timeline();
      ctx.lead = step.lead || "speaker";
      step.build(seg, ctx);
      const dur = Math.max(seg.duration(), 0.05);
      tl.add(seg, t);
      marks.push({ start: t, rest: t + dur });
      t += dur + hold;
    });
    tl.set({}, {}, t);
    /* Initialize every tween now (they record start values on first render), so the
       first play of a dense step does not stall on setup. Synchronous: never painted. */
    tl.progress(1, true).progress(0, true);
    window.__timelines = window.__timelines || {};
    window.__timelines[id] = tl;

    const N = steps.length;
    let cur = -1;
    let player = null;
    let idle = [];

    /* Idle loops run only in live mode, on wrappers the timeline never touches. */
    function startIdle(i) {
      if (!live || !steps[i].idle) return;
      const loops = [];
      const api = {
        loop(target, vars) {
          const props = Object.keys(vars).filter((k) => !["duration", "ease", "delay", "repeat", "yoyo", "repeatDelay"].includes(k));
          const els = gsap.utils.toArray(target);
          const rest = els.map((el) => {
            const o = {};
            props.forEach((p) => (o[p] = gsap.getProperty(el, p)));
            return o;
          });
          const tw = gsap.to(els, Object.assign({ repeat: -1, yoyo: true, ease: "sine.inOut" }, vars));
          loops.push({ tw, els, rest });
          return tw;
        },
      };
      steps[i].idle(api, ctx);
      idle = loops;
    }

    function stopIdle(instant) {
      idle.forEach(({ tw, els, rest }) => {
        tw.kill();
        els.forEach((el, k) => {
          if (instant) gsap.set(el, rest[k]);
          else gsap.to(el, Object.assign({ duration: 0.45, ease: "power2.out", overwrite: "auto" }, rest[k]));
        });
      });
      idle = [];
    }

    function rest(i) {
      cur = i;
      player = null;
      startIdle(i);
    }

    function play(i) {
      stopIdle(false);
      if (player) player.kill();
      cur = i;
      post({ type: "step", index: i, steps: N });
      tl.seek(marks[i].start, true);
      player = tl.tweenFromTo(marks[i].start, marks[i].rest, { ease: "none", onComplete: () => rest(i) });
    }

    function goTo(i) {
      const k = Math.max(0, Math.min(N - 1, i));
      if (player) player.kill();
      player = null;
      stopIdle(true);
      if (window.DeckSound) window.DeckSound.hush();
      tl.seek(marks[k].rest, true);
      post({ type: "step", index: k, steps: N });
      rest(k);
    }

    function next() {
      if (window.DeckSound) window.DeckSound.wake();
      if (player) {
        /* Mid-moment: finish this moment quickly instead of skipping it. */
        const left = player.duration() - player.time();
        if (left > 0.35) player.timeScale(left / 0.35);
        return;
      }
      if (cur >= N - 1) {
        post({ type: "end" });
        return;
      }
      play(cur + 1);
    }

    function back() {
      if (cur <= 0) {
        if (player) goTo(0);
        post({ type: "start" });
        return;
      }
      goTo(cur - 1);
    }

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data;
      if (!d || d.source !== "demo-stage") return;
      if (d.type === "next") next();
      else if (d.type === "back") back();
      else if (d.type === "goto" && Number.isFinite(d.step)) goTo(Math.round(d.step));
      else if (d.type === "sound") toast(window.DeckSound.set(!!d.on) ? "Sound on" : "Sound off");
    });

    window.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Spacebar") {
        e.preventDefault();
        if (!e.repeat) next();
      } else if (k === "ArrowLeft" || k === "PageUp") {
        e.preventDefault();
        if (!e.repeat) back();
      } else if (k === "m" || k === "M") {
        toast(window.DeckSound.set(!window.DeckSound.on) ? "Sound on" : "Sound off");
      }
    });

    const api = { tl, marks, steps, next, back, goTo, get index() { return cur; }, get playing() { return !!player; } };
    window.__deck = api;

    if (mode === "frame") {
      tl.seek(parseFloat(params.get("at")) || 0, true);
    } else if (mode === "render") {
      tl.seek(0, true);
    } else {
      startDrift();
      post({ type: "ready", steps: N });
      const startAt = params.has("step") ? parseInt(params.get("step"), 10) : null;
      if (startAt != null && Number.isFinite(startAt)) goTo(startAt);
      else play(0);
    }
    document.documentElement.dataset.deckReady = "1";
    return api;
  }

  /* The room never sees a frozen frame: a slow, layered sine drift on the whole picture. */
  function startDrift() {
    const el = document.getElementById("drift");
    if (!el) return;
    gsap.to(el, { x: 5, duration: 9.3, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(el, { y: -4, duration: 7.1, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.3 });
    gsap.fromTo(el, { scale: 1 }, { scale: 1.008, duration: 11.7, ease: "sine.inOut", repeat: -1, yoyo: true });
  }

  window.Deck = {
    W,
    H,
    rng,
    mode,
    live,
    embedded,
    /* A deck's editable words (content.json beside it). A missing or broken file falls back. */
    async load(url, fallback) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return fallback;
        return await response.json();
      } catch (e) {
        return fallback;
      }
    },
    async start(config) {
      fit();
      window.addEventListener("resize", fit);
      try {
        await document.fonts.ready;
      } catch (e) {
        /* fonts fall back */
      }
      /* Steps measure text, so fonts first; images the steps create decode before anything plays. */
      dressPhones();
      if (config.prepare) config.prepare();
      await settleAssets();
      return createDeck(config);
    },
  };
  fit();
})();
