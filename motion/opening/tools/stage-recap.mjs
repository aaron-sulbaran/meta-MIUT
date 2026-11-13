// stage-recap: jump the stage to Trish's last beat, then click through the recap deck into How we built it.
// usage: node stage-recap.mjs <baseUrl> <outDir> <indexBeforeRecap>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');
const [base, outDir, idx] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.__deckLog = [];
  window.addEventListener('message', (e) => { if (e.data && e.data.source === 'demo-deck') window.__deckLog.push(e.data.type + (e.data.index != null ? e.data.index : '') + (e.data.steps != null ? '/' + e.data.steps : '')); });
});
await page.goto(base + '/demo', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(5000);
await page.evaluate((i) => new BroadcastChannel('demo-stage').postMessage({ type: 'goto', index: Number(i) }), idx);
await page.waitForTimeout(5000);
const frames = () => page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src')).filter(Boolean).slice(0, 3));
console.log('at', idx, JSON.stringify(await frames()));
const deck = () => page.frames().find((f) => f.url().includes('/demo/deck/recap'));
const settled = async () => { for (let i = 0; i < 60; i++) { const f = deck(); const busy = f ? await f.evaluate(() => !window.__deck || window.__deck.playing).catch(() => true) : true; if (!busy) return; await page.waitForTimeout(200); } };
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(3000);
await settled();
console.log('after next', JSON.stringify(await frames()));
for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); await settled(); if (i === 3) await page.screenshot({ path: path.join(outDir, 'recap-moment.jpg'), type: 'jpeg', quality: 70 }); }
await page.screenshot({ path: path.join(outDir, 'recap-close.jpg'), type: 'jpeg', quality: 70 });
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(3000);
console.log('after end', JSON.stringify(await frames()));
console.log('messages', JSON.stringify(await page.evaluate(() => window.__deckLog)));
await browser.close();
