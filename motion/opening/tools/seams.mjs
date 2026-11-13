// seams: find what jumps or flashes in an opening deck. Samples the deck's timeline at a frame
// rate (small, by seeking), then reports
//   jump:  a click whose first frames do not continue from the previous step's rest frame,
//   flash: a single frame that differs from both neighbours while they agree with each other.
// usage: node seams.mjs <deckUrl> <outDir> [--fps 30] [--steps 3-9]
// Run through the machine's browser slot script; at most two Playwright browsers at once.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');

const args = process.argv.slice(2);
const [url, outDir] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const fps = Number(opt('--fps', 30));
const W = 480;
const H = 270;
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png') || f.endsWith('.raw')) rmSync(path.join(outDir, f));

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'render=1');
await page.waitForFunction(() => document.documentElement.dataset.deckReady === '1', null, { timeout: 30000 });
const marks = await page.evaluate(() => window.__deck.marks);
const ids = await page.evaluate(() => window.__deck.steps.map((s) => s.id));
const [a, b] = (opt('--steps') ?? `0-${marks.length - 1}`).split('-').map(Number);

const frames = [];
for (let i = a; i <= b; i++) {
  const m = marks[i];
  if (i > 0) frames.push({ t: marks[i - 1].rest, step: i, kind: 'prev-rest' });
  for (let t = m.start; t <= m.rest + 1e-6; t += 1 / fps) frames.push({ t, step: i, kind: t === m.start ? 'start' : 'run' });
  frames.push({ t: m.rest, step: i, kind: 'rest' });
}
let n = 0;
for (const f of frames) {
  await page.evaluate((t) => window.__deck.tl.seek(t, true), f.t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  f.file = `f_${String(n++).padStart(5, '0')}.png`;
  await page.screenshot({ path: path.join(outDir, f.file) });
}
await browser.close();

/* One grey raw buffer per frame, then mean absolute difference in percent of full scale. */
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(outDir, 'f_%05d.png'), '-f', 'rawvideo', '-pix_fmt', 'gray', path.join(outDir, 'all.raw')]);
const raw = readFileSync(path.join(outDir, 'all.raw'));
const size = W * H;
const frame = (k) => raw.subarray(k * size, (k + 1) * size);
const diff = (p, q) => {
  const x = frame(p);
  const y = frame(q);
  let s = 0;
  for (let i = 0; i < size; i++) s += Math.abs(x[i] - y[i]);
  return (s / size / 255) * 100;
};

const report = [];
for (let k = 0; k < frames.length; k++) {
  const f = frames[k];
  if (f.kind === 'prev-rest') {
    /* The click: the step's first two frames against where the last one rested. */
    const d1 = diff(k, k + 1);
    const d2 = diff(k, k + 2);
    report.push({ type: 'click', step: f.step, id: ids[f.step], first: +d1.toFixed(2), second: +d2.toFixed(2) });
  }
  if (f.kind === 'run' && k > 0 && k + 1 < frames.length && frames[k + 1].step === f.step && frames[k - 1].step === f.step) {
    const dp = diff(k - 1, k);
    const dn = diff(k, k + 1);
    const around = diff(k - 1, k + 1);
    if (dp > 1.5 && dn > 1.5 && around < Math.min(dp, dn) * 0.35) {
      report.push({ type: 'flash', step: f.step, id: ids[f.step], at: +(f.t - marks[f.step].start).toFixed(3), into: +dp.toFixed(2), out: +dn.toFixed(2), around: +around.toFixed(2), file: f.file });
    }
  }
}
writeFileSync(path.join(outDir, 'seams.json'), JSON.stringify({ url, fps, frames: frames.length, report }, null, 2));
for (const r of report) {
  if (r.type === 'click' && r.first < 0.6) continue;
  console.log(JSON.stringify(r));
}
console.log(`${frames.length} frames checked; clicks with a first frame over 0.6 percent and every flash are listed above`);
