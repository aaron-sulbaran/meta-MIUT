// stage-e2e: the whole pitch on the stage, start to end. Opens /demo, presses Next until the
// last beat's last deck step, and records every beat and deck step the stage reports, with a
// screenshot per press. Waits for each deck moment to finish before the next press.
// usage: node stage-e2e.mjs <baseUrl> <outDir> [--max 160]
// Run through the machine's browser slot script; at most two Playwright browsers at once.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'))('playwright-core');

const args = process.argv.slice(2);
const [base, outDir] = args;
const max = Number(args.includes('--max') ? args[args.indexOf('--max') + 1] : 160);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  window.__deckLog = [];
  window.addEventListener('message', (e) => {
    if (e.data && e.data.source === 'demo-deck') window.__deckLog.push({ type: e.data.type, index: e.data.index, steps: e.data.steps });
  });
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
await page.goto(base + '/demo', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(6000);

const position = () => page.evaluate(async () => {
  const r = await fetch('/api/demo/stage', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
  return r && r.data ? { index: r.data.index, deck: r.data.deck || null } : null;
});
const deckFrame = () => page.frames().find((f) => f.url().includes('/demo/deck/'));
const settle = async () => {
  for (let i = 0; i < 80; i++) {
    const f = deckFrame();
    if (!f) return;
    const busy = await f.evaluate(() => !window.__deck || window.__deck.playing).catch(() => true);
    if (!busy) return;
    await page.waitForTimeout(200);
  }
};

const trail = [];
await settle();
for (let n = 0; n < max; n++) {
  const pos = await position();
  const f = deckFrame();
  const deck = f ? new URL(f.url()).pathname.split('/')[3] : null;
  const step = f ? await f.evaluate(() => (window.__deck ? window.__deck.index : null)).catch(() => null) : null;
  const total = f ? await f.evaluate(() => (window.__deck ? window.__deck.steps.length : null)).catch(() => null) : null;
  const row = { n, beat: pos ? pos.index : null, deck, step, total };
  trail.push(row);
  await page.screenshot({ path: path.join(outDir, `p${String(n).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 55 });
  console.log(JSON.stringify(row));
  if (deck === 'appendix' && step != null && total != null && step === total - 1) break;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(f ? 400 : 2600);
  await settle();
}
writeFileSync(path.join(outDir, 'trail.json'), JSON.stringify({ trail, errors, deckLog: await page.evaluate(() => window.__deckLog) }, null, 2));
console.log('errors', JSON.stringify(errors));
await browser.close();
