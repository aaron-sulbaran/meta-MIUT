// stage-check: drive /demo with the keyboard and record what the decks tell the stage.
// usage: node stage-check.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');
const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.__deckLog = [];
  window.addEventListener('message', (e) => {
    if (e.data && e.data.source === 'demo-deck') window.__deckLog.push({ ...e.data, t: Math.round(performance.now()) });
  });
});
await page.goto(base + '/demo', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('iframe[src*="/demo/deck/"]', { timeout: 60000 });
await page.waitForTimeout(4000);
const frameSrc = async () => page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src')));
console.log('frames at start', JSON.stringify(await frameSrc()));
const deckFrame = () => page.frames().find((f) => f.url().includes('/demo/deck/'));
const settled = async () => {
  for (let i = 0; i < 60; i++) {
    const f = deckFrame();
    const busy = f ? await f.evaluate(() => !window.__deck || window.__deck.playing).catch(() => true) : true;
    if (!busy) return;
    await page.waitForTimeout(200);
  }
};
const press = async (key, wait) => { await page.keyboard.press(key); await page.waitForTimeout(wait); await settled(); };
// Problem deck: 16 nexts to its last step, one more to end, then the muse deck.
await settled();
for (let i = 0; i < 16; i++) await press('ArrowRight', 300);
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(outDir, 'problem-last.jpg'), type: 'jpeg', quality: 70 });
await press('ArrowRight', 3500);
console.log('frames after end', JSON.stringify(await frameSrc()));
await page.screenshot({ path: path.join(outDir, 'muse-first.jpg'), type: 'jpeg', quality: 70 });
// Back from the muse deck's first step returns to the problem deck at its last step.
await press('ArrowLeft', 3500);
console.log('frames after back', JSON.stringify(await frameSrc()));
await page.screenshot({ path: path.join(outDir, 'back-into-problem.jpg'), type: 'jpeg', quality: 70 });
const log = await page.evaluate(() => window.__deckLog);
console.log('messages', log.length, JSON.stringify(log.map((m) => m.type + (m.index != null ? m.index : '') + (m.steps != null ? '/' + m.steps : ''))));
await browser.close();
