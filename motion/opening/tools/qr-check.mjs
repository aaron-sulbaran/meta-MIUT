// qr-check: render a deck step's rest frame at projector sizes and decode the QR code on it,
// so the code is proven to scan before anyone points a phone at it.
// usage: node qr-check.mjs <qrToolsDir> <deckUrl> <stepIndex> [outDir]
//   qrToolsDir: a folder with jsqr@1.4.0 and pngjs@7.0.0 installed (kept out of the repo).
// Run through the machine's browser slot script; at most two Playwright browsers at once.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [toolsDir, url, stepArg, outArg] = process.argv.slice(2);
const step = Number(stepArg);
const outDir = outArg || path.join(process.cwd(), 'motion/opening/.frames/qr');
mkdirSync(outDir, { recursive: true });
const pw = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'))('playwright-core');
const tools = createRequire(path.join(path.resolve(toolsDir), 'package.json'));
const jsQR = tools('jsqr');
const { PNG } = tools('pngjs');

/* Software rendering: a still frame needs no GPU, and a shared GPU has stalled seeks here. */
const browser = await pw.chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] });
const log = (m) => console.error(`[qr-check] ${m}`);
log('browser up');
const results = [];
for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 576]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'render=1', { timeout: 30000 });
  log(`loaded at ${w}`);
  await page.waitForFunction(() => document.documentElement.dataset.deckReady === '1', null, { timeout: 30000 }).catch(async () => {
    log('not ready, reloading');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.deckReady === '1', null, { timeout: 30000 });
  });
  log(`ready at ${w}`);
  await page.evaluate((k) => { window.__deck.tl.seek(window.__deck.marks[k].rest, true); }, step);
  log(`seeked at ${w}`);
  await page.waitForTimeout(150);
  const file = path.join(outDir, `qr-${path.basename(path.dirname(new URL(url).pathname))}-${w}.png`);
  await page.screenshot({ path: file });
  const png = PNG.sync.read(readFileSync(file));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  results.push({ size: `${w}x${h}`, decoded: code ? code.data : null, file });
  await page.close();
}
await browser.close();
for (const r of results) console.log(JSON.stringify(r));
if (results.some((r) => !r.decoded)) process.exitCode = 1;
