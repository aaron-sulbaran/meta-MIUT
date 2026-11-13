// frames: capture exact frames of an opening deck by seeking its timeline, and tile them into a sheet.
// usage: node frames.mjs <deckUrl> <outDir> [--step k --n 12] [--rests] [--at 1.2,3.4] [--cols 4] [--w 640]
// Run through the machine's browser slot script; at most two Playwright browsers at once.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');

const args = process.argv.slice(2);
const [url, outDir] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const cols = Number(opt('--cols', 4));
const tileW = Number(opt('--w', 640));
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.startsWith('f_')) rmSync(path.join(outDir, f));

const gpu = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args: gpu }).catch(() => chromium.launch({ args: gpu }));
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const sep = url.includes('?') ? '&' : '?';
const ready = () => page.waitForFunction(() => document.documentElement.dataset.deckReady === '1', null, { timeout: 20000 });
await page.goto(url + sep + 'render=1');
/* The local static server occasionally stalls one asset; one reload clears it. */
await ready().catch(async () => {
  await page.reload();
  await ready();
});
const marks = await page.evaluate(() => window.__deck.marks);
const ids = await page.evaluate(() => window.__deck.steps.map((s) => s.id));
if (opt('--steps-json')) {
  const { writeFileSync } = await import('node:fs');
  const list = await page.evaluate(() => window.__deck.steps.map(({ id, title, notes }) => ({ id, title, notes: notes || '' })));
  writeFileSync(opt('--steps-json'), JSON.stringify(list, null, 2) + '\n');
  console.log(`wrote ${list.length} steps to ${opt('--steps-json')}`);
}
let times = [];
if (args.includes('--rests')) times = marks.map((m, i) => ({ t: m.rest, label: `${i} ${ids[i]} rest` }));
if (opt('--step') != null) {
  const k = Number(opt('--step'));
  const n = Number(opt('--n', 12));
  const m = marks[k];
  for (let j = 0; j < n; j++) {
    const t = m.start + ((m.rest - m.start) * (j + 1)) / n;
    times.push({ t, label: `${k} ${ids[k]} +${(t - m.start).toFixed(2)}s` });
  }
}
if (opt('--at')) times.push(...opt('--at').split(',').map((s) => ({ t: Number(s), label: `t=${s}` })));
await page.evaluate(() => {
  const l = document.createElement('div');
  l.id = '__label';
  l.style.cssText = 'position:fixed;left:12px;top:10px;z-index:99;font:600 28px/1.2 system-ui;color:#fff;background:rgba(200,0,60,.85);padding:4px 10px;border-radius:6px';
  document.body.appendChild(l);
});
let i = 0;
for (const { t, label } of times) {
  await page.evaluate(([t, label]) => { window.__deck.tl.seek(t, true); document.getElementById('__label').textContent = label; }, [t, label]);
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(outDir, `f_${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 82 });
  i++;
}
await browser.close();
const rows = Math.ceil(i / cols);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(outDir, 'f_%03d.jpg'), '-vf', `scale=${tileW}:-1,tile=${cols}x${rows}:padding=6:color=0x444444`, '-frames:v', '1', path.join(outDir, 'sheet.jpg')]);
console.log(`${i} frames -> ${path.join(outDir, 'sheet.jpg')}`);
console.log(JSON.stringify(marks.map((m, k) => `${k} ${ids[k]} ${m.start.toFixed(2)}-${m.rest.toFixed(2)}`)));
