// appshots: real captures of this app for the opening decks, at a 390 x 844 phone viewport, 3x.
// usage: node appshots.mjs <baseUrl> <outDir> <name...>   (names below; run through the browser slot script)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');
const [base, outDir, ...names] = process.argv.slice(2);
// The demo clock: the story event then reads 7:00 PM, the evening the pitch describes.
const AT = process.env.DECK_AT || '2026-11-13T23:35:00.000Z';
mkdirSync(outDir, { recursive: true });

const hideDev = async (page) => page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
const SHOTS = {
  async map(page, shot) {
    await page.goto(base + '/');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(5000);
    /* The nearby-alert prompt is a one-time ask; close it so the map reads clean. */
    await page.getByRole('button', { name: /close|dismiss|not now/i }).last().click().catch(() => {});
    await page.waitForTimeout(800);
    await hideDev(page);
    await shot('map');
  },
  async list(page, shot) {
    await page.goto(base + '/?view=list');
    /* Sprout's first-visit hello hides itself after a few seconds; the alert ask closes. */
    await page.waitForTimeout(9000);
    await page.getByRole('button', { name: /close|dismiss|not now/i }).last().click().catch(() => {});
    await page.waitForTimeout(800);
    await hideDev(page);
    await shot('list');
  },
  async organizer(page, shot) {
    await page.goto(base + '/organizer?handoff=story&at=' + encodeURIComponent(AT));
    await hideDev(page);
    let last = 0;
    for (const ms of [600, 1400, 2400, 3600, 5000, 7000, 10000, 14000]) {
      await page.waitForTimeout(ms - last);
      last = ms;
      await shot(`organizer-${ms}`);
    }
  },
  async listfree(page, shot) {
    await page.goto(base + '/?view=list&chip=free');
    await page.waitForTimeout(4000);
    await hideDev(page);
    await shot('list-free');
  },
  async walkhome(page, shot) {
    await page.goto(base + '/?plan=home&time=' + encodeURIComponent(AT), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(16000);
    await hideDev(page);
    await shot('walkhome');
  },
  async curate(page, shot) {
    await page.goto(base + '/curate');
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /curate my feed/i }).click().catch(() => {});
    await page.waitForTimeout(16000);
    await hideDev(page);
    await shot('curate');
  },
  async posted(page, shot) {
    await page.goto(base + '/organizer?state=posted&at=' + encodeURIComponent(AT));
    await page.waitForTimeout(3000);
    await hideDev(page);
    await shot('posted');
  },
  async igpost(page, shot) {
    await page.goto(base + '/demo/instagram/post?at=' + encodeURIComponent(AT));
    await page.waitForTimeout(3000);
    await hideDev(page);
    await shot('igpost');
  },
  async flyer(page) {
    const res = await page.request.get(base + '/demo/flyer.png?at=' + encodeURIComponent(AT));
    writeFileSync(path.join(outDir, 'board-game-night-flyer.png'), await res.body());
  },
};

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const shot = (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });
  try {
    await SHOTS[name](page, shot);
    console.log('ok', name);
  } catch (e) {
    console.log('fail', name, e.message.split('\n')[0]);
  }
  await ctx.close();
}
await browser.close();
