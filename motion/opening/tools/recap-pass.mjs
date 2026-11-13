// recap-pass: one capture pass for the recap deck. Each run loads the real screen inside a
// 390 x 844 frame (as the stage shows it, as the right person), waits for the app's own time
// stamp, and records its number, where it sits, and a 3x capture. The deck then shows the
// median run's capture with that run's number, so the screen and the number always agree.
// usage: node recap-pass.mjs <baseUrl> <outDir> <moment> [--runs 5]
//   moments: flyer, walk, replan, picks, hello (needs a fresh server per run), heard
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'));
const { chromium } = require('playwright-core');

const args = process.argv.slice(2);
const [base, outDir, moment] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const runs = Number(opt('--runs', 5));
const AT = '2026-11-13T20:05:00.000Z';
const REPLAN = "Wait, actually I'm not going home, I was gonna hang out with Lisa. Can you find an event closer to both of us and send Lisa the invite?";
mkdirSync(outDir, { recursive: true });
const resultsPath = path.join(outDir, 'recap-pass.json');
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : {};

const storyId = async () => {
  const story = await (await fetch(`${base}/api/demo/story`)).json().catch(() => null);
  return story?.data?.id ?? story?.data?.event?.id ?? null;
};
const skitState = async () => {
  await fetch(`${base}/organizer?state=posted&at=${encodeURIComponent(AT)}`);
  const id = await storyId();
  const asLisa = { 'content-type': 'application/json', cookie: 'demo-persona=lisa' };
  await fetch(`${base}/api/invite/${encodeURIComponent(id)}/accept`, { method: 'POST', headers: asLisa, body: JSON.stringify({ from: 'sample-student' }) });
  await fetch(`${base}/api/social/events/${encodeURIComponent(id)}`, { method: 'POST', headers: asLisa, body: JSON.stringify({ going: true, open: true }) });
  return id;
};

const MOMENTS = {
  flyer: { persona: 'organizer', url: () => `/organizer?handoff=story&at=${encodeURIComponent(AT)}`, stamp: /Read in ([\d.]+)\s?s/, settle: 4000 },
  walk: { persona: null, url: () => `/?plan=home&time=${encodeURIComponent(AT)}`, stamp: /planned ([\d.]+)\s?s/, settle: 4500 },
  replan: { persona: null, url: () => `/?plan=home&auto=1&time=${encodeURIComponent(AT)}`, stamp: /asked ([\d.]+)\s?s/ },
  picks: { persona: 'user3', url: () => '/?first=1', stamp: /picked ([\d.]+)\s?s/ },
  hello: {
    persona: 'user3',
    prepare: skitState,
    url: (id) => `/events/${encodeURIComponent(id)}?auto=1`,
    act: async (frame) => {
      await frame.getByRole('button', { name: /say hi to jolyn and lisa/i }).first().click({ timeout: 20000 });
    },
    stamp: /Live, ([\d.]+)\s?s/,
    settle: 3500,
  },
  /* The Events screens the decks show around the recap: on the demo clock, inside a frame. */
  list: { persona: null, url: () => '/?view=list', stamp: /Top 3 for you today/, settle: 11000 },
  home: { persona: null, url: () => '/', stamp: /For you/, settle: 9000 },
  heard: {
    persona: null,
    url: () => `/?plan=home&time=${encodeURIComponent(AT)}`,
    act: async (frame, page) => {
      await frame.getByText(/planned [\d.]+\s?s/).first().waitFor({ timeout: 30000 });
      await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ source: 'demo-stage', type: 'listening', on: true }, location.origin));
      await page.waitForTimeout(1200);
      await page.evaluate((text) => document.getElementById('f').contentWindow.postMessage({ source: 'demo-stage', type: 'heard', text }, location.origin), REPLAN);
    },
    stamp: /Wait, actually/,
    settle: 1400,
  },
};

const m = MOMENTS[moment];
if (!m) throw new Error('unknown moment ' + moment);
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const list = results[moment]?.runs ?? [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  if (m.persona) await ctx.addCookies([{ name: 'demo-persona', value: m.persona, url: base }]);
  const page = await ctx.newPage();
  const id = m.prepare ? await m.prepare() : null;
  const html = `<!doctype html><html><body style="margin:0"><iframe id="f" src="${base}${m.url(id)}" style="border:0;width:390px;height:844px"></iframe></body></html>`;
  await page.route(base + '/__host', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(base + '/__host', { waitUntil: 'domcontentloaded' });
  const frame = page.frameLocator('#f');
  const n = list.length + 1;
  try {
    if (m.act) {
      await page.waitForTimeout(moment === 'hello' ? 9000 : 0);
      await m.act(frame, page);
    }
    const stampEl = frame.getByText(m.stamp).first();
    await stampEl.waitFor({ timeout: 40000 });
    await page.waitForTimeout(m.settle ?? 500);
    const box = await stampEl.boundingBox();
    if (box && box.y < 70) {
      await frame.locator('body').evaluate(() => window.scrollBy(0, -200));
      await page.waitForTimeout(400);
    }
    const finalBox = await stampEl.boundingBox();
    const text = (await stampEl.textContent()) ?? '';
    const match = text.match(m.stamp);
    const seconds = match && match[1] ? Number(match[1]) : null;
    const file = `${moment}-${n}.png`;
    await page.locator('#f').screenshot({ path: path.join(outDir, file) });
    list.push({ run: n, seconds, text: text.trim().slice(0, 120), box: finalBox, file, at: new Date().toISOString() });
    console.log(moment, n, seconds, JSON.stringify(finalBox));
  } catch (e) {
    console.log(moment, n, 'failed', e.message.split('\n')[0]);
  }
  await ctx.close();
}
await browser.close();
const timed = list.filter((r) => r.seconds != null).sort((a, b) => a.seconds - b.seconds);
const median = timed.length ? timed[Math.floor((timed.length - 1) / 2)] : null;
results[moment] = { runs: list, median: median ? median.seconds : null, chosen: median ? median.file : list.at(-1)?.file ?? null, chosenBox: median ? median.box : list.at(-1)?.box ?? null };
writeFileSync(resultsPath, JSON.stringify(results, null, 2) + '\n');
console.log(moment, 'median', results[moment].median, 'chosen', results[moment].chosen);
