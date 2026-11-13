/* Synthesized sound for the opening decks: no files, no network.
   Off by default. "M" toggles it; the choice is remembered per browser
   (localStorage "deck-sound"), so turning it on in a tab carries into the stage. */
(function () {
  "use strict";
  let ctx = null;
  let bus = null;
  let noise = null;
  let on = false;
  try {
    on = localStorage.getItem("deck-sound") === "on";
  } catch (e) {
    on = false;
  }

  function makeBus() {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const gain = ctx.createGain();
    gain.gain.value = 0.8;
    gain.connect(comp);
    comp.connect(ctx.destination);
    return { input: gain, comp };
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      bus = makeBus();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 7;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  /* Hard cut: drop every tail by replacing the bus. */
  function hush() {
    if (!ctx || !bus) return;
    const old = bus;
    old.input.gain.cancelScheduledValues(ctx.currentTime);
    old.input.gain.setValueAtTime(0, ctx.currentTime);
    setTimeout(() => old.comp.disconnect(), 50);
    bus = makeBus();
  }

  function env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function osc(type, freq, t) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  function out(node, level) {
    const g = ctx.createGain();
    g.gain.value = level == null ? 1 : level;
    node.connect(g);
    g.connect(bus.input);
    return g;
  }

  const voices = {
    /* A soft key press: a filtered tick and a tiny body. */
    key(t, o) {
      const v = o.v == null ? 0.5 : o.v;
      const n = noiseSrc(t, 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2600 + v * 1800;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      env(g, t, 0.32, 0.001, 0.028);
      n.connect(bp).connect(g);
      out(g, 0.55);
      const b = osc("sine", 170 + v * 60, t);
      const bg = ctx.createGain();
      env(bg, t, 0.18, 0.001, 0.03);
      b.connect(bg);
      out(bg, 0.5);
      b.start(t);
      b.stop(t + 0.06);
    },
    /* A message arriving: a glassy two-partial ding. */
    ding(t, o) {
      const f = o.f || 1175;
      const level = o.level == null ? 0.22 : o.level;
      const a = osc("sine", f, t);
      const b = osc("sine", f * 2.0, t);
      const ga = ctx.createGain();
      const gb = ctx.createGain();
      env(ga, t, level, 0.004, o.decay || 0.42);
      env(gb, t, level * 0.28, 0.004, (o.decay || 0.42) * 0.55);
      a.connect(ga);
      b.connect(gb);
      out(ga);
      out(gb);
      a.start(t);
      b.start(t);
      a.stop(t + 0.6);
      b.stop(t + 0.6);
    },
    /* A bubble or flyer popping in. */
    pop(t, o) {
      const f = o.f || 520;
      const a = osc("sine", f, t);
      a.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.07);
      const g = ctx.createGain();
      env(g, t, o.level || 0.26, 0.003, 0.09);
      a.connect(g);
      out(g);
      a.start(t);
      a.stop(t + 0.14);
    },
    /* A deep, wide impact for a reveal. */
    impact(t, o) {
      const level = o.level || 0.9;
      const sub = osc("sine", 72, t);
      sub.frequency.exponentialRampToValueAtTime(36, t + 0.9);
      const sg = ctx.createGain();
      env(sg, t, level, 0.006, 1.6);
      sub.connect(sg);
      out(sg);
      sub.start(t);
      sub.stop(t + 1.8);
      const body = osc("triangle", 150, t);
      body.frequency.exponentialRampToValueAtTime(70, t + 0.25);
      const bg = ctx.createGain();
      env(bg, t, level * 0.4, 0.003, 0.32);
      body.connect(bg);
      out(bg);
      body.start(t);
      body.stop(t + 0.4);
      const n = noiseSrc(t, 0.5);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      const ng = ctx.createGain();
      env(ng, t, level * 0.35, 0.002, 0.42);
      n.connect(lp).connect(ng);
      out(ng);
    },
    /* A low, slightly sour tone for a missed thing. */
    error(t, o) {
      const level = o.level || 0.3;
      [98, 103.5].forEach((f) => {
        const a = osc("sawtooth", f, t);
        a.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.6);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 520;
        const g = ctx.createGain();
        env(g, t, level, 0.01, 0.75);
        a.connect(lp).connect(g);
        out(g);
        a.start(t);
        a.stop(t + 0.9);
      });
      voices.thud(t, { level: 0.5 });
    },
    thud(t, o) {
      const a = osc("sine", 90, t);
      a.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const g = ctx.createGain();
      env(g, t, o.level || 0.6, 0.002, 0.24);
      a.connect(g);
      out(g);
      a.start(t);
      a.stop(t + 0.3);
      const n = noiseSrc(t, 0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      const ng = ctx.createGain();
      env(ng, t, (o.level || 0.6) * 0.5, 0.001, 0.08);
      n.connect(lp).connect(ng);
      out(ng);
    },
    /* Air moving past: band-passed noise sweeping up. */
    whoosh(t, o) {
      const dur = o.dur || 0.5;
      const n = noiseSrc(t, dur);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(o.from || 300, t);
      bp.frequency.exponentialRampToValueAtTime(o.to || 2600, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.level || 0.18, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g);
      out(g);
    },
    /* A light shimmer for Muse reading something. */
    scan(t, o) {
      const dur = o.dur || 1.2;
      const a = osc("sine", 1900, t);
      a.frequency.linearRampToValueAtTime(2500, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.level || 0.035, t + 0.12);
      g.gain.setValueAtTime(o.level || 0.035, t + dur - 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      a.connect(g);
      out(g);
      a.start(t);
      a.stop(t + dur + 0.05);
      const n = noiseSrc(t, dur);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.03, t + 0.15);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(hp).connect(ng);
      out(ng);
    },
    /* A UI tap. */
    tap(t, o) {
      const a = osc("sine", o.f || 1600, t);
      const g = ctx.createGain();
      env(g, t, o.level || 0.12, 0.001, 0.035);
      a.connect(g);
      out(g);
      a.start(t);
      a.stop(t + 0.06);
    },
    /* A warm, short chord swell for a resolve. */
    swell(t, o) {
      const dur = o.dur || 2.2;
      const level = o.level || 0.07;
      (o.notes || [261.6, 329.6, 392, 523.3]).forEach((f, i) => {
        const a = osc("triangle", f, t);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(600, t);
        lp.frequency.linearRampToValueAtTime(2400, t + dur * 0.6);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level / (1 + i * 0.3), t + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        a.connect(lp).connect(g);
        out(g);
        a.start(t);
        a.stop(t + dur + 0.05);
      });
    },
  };

  window.DeckSound = {
    get on() {
      return on;
    },
    set(value) {
      on = !!value;
      try {
        localStorage.setItem("deck-sound", on ? "on" : "off");
      } catch (e) {
        /* private mode: the toggle still works for this page */
      }
      if (on) ensure();
      else hush();
      return on;
    },
    /* Called from a user gesture so the context may start. */
    wake() {
      if (on) ensure();
    },
    hush,
    play(name, opts) {
      if (!on || !voices[name]) return;
      if (!ensure()) return;
      voices[name](ctx.currentTime + 0.005, opts || {});
    },
  };
})();
