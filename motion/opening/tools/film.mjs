// film: render a deck to a backup film for the stage's film fallback.
// Each step's moment plays back to back (no holds); the cues file lists where each step rests.
// usage: node film.mjs <deckUrl> <framesDir> <out.mp4> <out.cues.json> [--fps 30] [--crf 24]
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const [url, dir, outMp4, outCues] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? Number(args[i + 1]) : d; };
const fps = opt('--fps', 30);
const crf = opt('--crf', 24);
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.startsWith('f_')) rmSync(path.join(dir, f));
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const ready = () => page.waitForFunction(() => document.documentElement.dataset.deckReady === '1', null, { timeout: 20000 });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'render=1');
await ready().catch(async () => { await page.reload(); await ready(); });
const marks = await page.evaluate(() => window.__deck.marks);
let n = 0;
const cues = [];
for (const m of marks) {
  const frames = Math.max(1, Math.round((m.rest - m.start) * fps));
  for (let j = 1; j <= frames; j++) {
    const t = m.start + ((m.rest - m.start) * j) / frames;
    await page.evaluate((t) => window.__deck.tl.seek(t, true), t);
    await page.screenshot({ path: path.join(dir, `f_${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    n++;
  }
  cues.push(Number((n / fps).toFixed(3)));
}
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f_%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outMp4]);
writeFileSync(outCues, JSON.stringify(cues) + '\n');
console.log(`${n} frames, ${(n / fps).toFixed(1)} s -> ${outMp4}; ${cues.length} cues`);
