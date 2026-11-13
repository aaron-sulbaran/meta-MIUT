// fps: play one step live and report frame-time stats from requestAnimationFrame.
// usage: node fps.mjs <deckUrl> <step> [--headed]
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');
const [url, stepArg] = process.argv.slice(2);
const step = Number(stepArg);
const headed = process.argv.includes('--headed');
const gpu = ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'];
const browser = await chromium.launch({ channel: 'chrome', headless: !headed, args: gpu });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.waitForFunction(() => document.documentElement.dataset.deckReady === '1');
const stats = await page.evaluate(async (step) => {
  const d = window.__deck;
  d.goTo(step - 1);
  await new Promise((r) => setTimeout(r, 400));
  const dur = d.marks[step].rest - d.marks[step].start;
  const deltas = [];
  let last = performance.now();
  let run = true;
  const tick = (now) => { deltas.push(now - last); last = now; if (run) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  d.next();
  await new Promise((r) => setTimeout(r, dur * 1000 + 200));
  run = false;
  deltas.shift();
  const slow = deltas.map((x, i) => [i, Math.round(x)]).filter(([, x]) => x > 20);
  deltas.sort((a, b) => a - b);
  const q = (p) => deltas[Math.floor(deltas.length * p)];
  return { frames: deltas.length, seconds: dur, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: deltas[deltas.length - 1], over20: deltas.filter((x) => x > 20).length, slow };
}, step);
console.log(JSON.stringify(stats));
await browser.close();
