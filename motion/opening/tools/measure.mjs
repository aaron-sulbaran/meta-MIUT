// measure: time the live Muse calls behind the recap deck's moments, end to end over HTTP,
// the same round trip the app's own timer shows on screen. Only runs answered by Muse count
// (a recorded fallback is reported, never averaged in).
// usage: node measure.mjs <baseUrl> <wavPath> [--runs 5] [--out timings.json]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const [base, wavPath] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const runs = Number(opt('--runs', 5));
const out = opt('--out', null);
const AT = '2026-11-13T20:05:00.000Z';
const CAPTION = 'Board Game Night + Free Dumplings today at the MIT Museum (314 Main St), 3:30 to 5:30 PM: free dumplings while they last and 40 board games. Open to everyone, no experience needed. Come by after class!';
const REPLAN = "Wait, actually I'm not going home, I was gonna hang out with Lisa. Can you find an event closer to both of us and send Lisa the invite?";
const STUDENT = { lat: 42.3616, lng: -71.0906 };
const HOME = { lat: 42.3575, lng: -71.0934 };

const flyer = Buffer.from(await (await fetch(`${base}/demo/flyer.png?at=${encodeURIComponent(AT)}`)).arrayBuffer()).toString('base64');
const wav = readFileSync(wavPath);

const json = (path, body) => () => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const MOMENTS = {
  flyer: json('/api/muse/extract', { caption: CAPTION, imageBase64: flyer, imageMediaType: 'image/png' }),
  walkHome: json('/api/muse/crawl', { from: STUDENT, to: HOME, toLabel: 'Maseeh Hall', mode: 'walk', at: AT, exclude: [] }),
  transcribe: () => {
    const form = new FormData();
    form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'line.wav');
    return fetch(base + '/api/muse/transcribe', { method: 'POST', body: form });
  },
  replan: json('/api/muse/ask', { question: REPLAN, fresh: true }),
  curate: json('/api/curate', undefined),
};

const results = {};
for (const [name, call] of Object.entries(MOMENTS)) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    let status = 0;
    let source = 'unknown';
    try {
      const res = await call();
      status = res.status;
      const body = await res.json().catch(() => null);
      source = body?.source ?? body?.data?.source ?? (name === 'transcribe' && body?.data?.transcript ? 'muse' : 'unknown');
    } catch (e) {
      source = 'error';
    }
    const ms = Math.round(performance.now() - t0);
    samples.push({ ms, status, source });
    console.log(name, i + 1, ms, status, source);
  }
  const live = samples.filter((s) => s.status === 200 && s.source === 'muse').map((s) => s.ms).sort((a, b) => a - b);
  const median = live.length ? live[Math.floor(live.length / 2)] : null;
  results[name] = { samples, liveRuns: live.length, minMs: live[0] ?? null, medianMs: median, maxMs: live[live.length - 1] ?? null };
}
const report = { measuredAt: new Date().toISOString(), base, runs, demoClock: AT, results };
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, [v.liveRuns, v.minMs, v.medianMs, v.maxMs]]))));
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
