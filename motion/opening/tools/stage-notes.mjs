// stage-notes: the stage at a laptop width with the phone remote beside it. Checks that P1 opens
// on the QR code (decoded from the stage's own frame), that the first click starts the hook, that
// the remote's note matches every problem-deck step, and that the thank you shows the code.
// usage: node stage-notes.mjs <qrToolsDir> <baseUrl> <outDir> [--w 1440 --h 900]
//   qrToolsDir: a folder with jsqr@1.4.0 and pngjs@7.0.0 installed (kept out of the repo).
// Run through the machine's browser slot script; at most two Playwright browsers at once.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(path.join(process.env.HOME, '.claude/skills/design-review/scripts/package.json'))('playwright-core');

const args = process.argv.slice(2);
const [toolsDir, base, outDir] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? Number(args[i + 1]) : d; };
const W = opt('--w', 1440);
const H = opt('--h', 900);
const tools = createRequire(path.join(path.resolve(toolsDir), 'package.json'));
const jsQR = tools('jsqr');
const { PNG } = tools('pngjs');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu', '--mute-audio'] });
const stage = await browser.newPage({ viewport: { width: W, height: H } });
const remote = await browser.newPage({ viewport: { width: 390, height: 844 } });
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };

const decode = async (file) => {
  await stage.screenshot({ path: file });
  const png = PNG.sync.read(readFileSync(file));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
};
const deckFrame = () => stage.frames().find((f) => f.url().includes('/demo/deck/'));
const settle = async () => {
  for (let i = 0; i < 80; i++) {
    const f = deckFrame();
    const busy = f ? await f.evaluate(() => !window.__deck || window.__deck.playing).catch(() => true) : true;
    if (!busy) return;
    await stage.waitForTimeout(200);
  }
};
const deckNow = async () => {
  const f = deckFrame();
  if (!f) return null;
  return f.evaluate(() => {
    const d = window.__deck;
    if (!d) return null;
    const s = d.steps[d.index];
    return { deck: location.pathname.split('/')[3], index: d.index, id: s.id, notes: s.notes };
  }).catch(() => null);
};
/* The remote polls the stage's record; give it a few seconds to show the step's note. */
const remoteShows = async (notes) => {
  const probe = notes.slice(0, 28);
  for (let i = 0; i < 30; i++) {
    const text = await remote.evaluate(() => document.body.innerText).catch(() => '');
    if (text.replace(/\s+/g, ' ').includes(probe)) return true;
    await remote.waitForTimeout(300);
  }
  return false;
};

await stage.goto(base + '/demo', { waitUntil: 'domcontentloaded', timeout: 90000 });
await remote.goto(base + '/demo/remote', { waitUntil: 'domcontentloaded', timeout: 90000 });
await stage.waitForTimeout(5000);
await settle();

const first = await deckNow();
check('P1 opens on the code (try-it)', first && first.deck === 'problem' && first.id === 'try-it', JSON.stringify(first && { deck: first.deck, id: first.id }));
const qr1 = await decode(path.join(outDir, `p1-${W}.png`));
check(`QR on P1 decodes at ${W}x${H}`, qr1 === 'https://meta-miut.vercel.app', String(qr1));

let mismatches = 0;
for (let k = 0; k < 40; k++) {
  const now = await deckNow();
  if (!now || now.deck !== 'problem') break;
  const ok = await remoteShows(now.notes);
  if (!ok) mismatches++;
  console.log(`  step ${now.index} ${now.id}: remote ${ok ? 'matches' : 'MISSING'} "${now.notes.slice(0, 50)}"`);
  if (k === 1) check('First click starts the hook (hook-caret)', now.id === 'hook-caret', now.id);
  await stage.keyboard.press('ArrowRight');
  await stage.waitForTimeout(400);
  await settle();
}
check('Remote note matches every problem-deck step', mismatches === 0, `${mismatches} missing`);

/* Jump to What's next, then Next to the thank you. */
const nextIndex = await stage.evaluate(async () => {
  const r = await fetch('/api/demo/stage', { cache: 'no-store' }).then((x) => x.json());
  return r;
});
const beatOfNext = 27;
await stage.evaluate(async (index) => {
  await fetch('/api/demo/stage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'goto', index }) });
}, beatOfNext);
for (let i = 0; i < 50; i++) {
  const now = await deckNow();
  if (now && now.deck === 'next') break;
  await stage.waitForTimeout(300);
}
await settle();
await stage.keyboard.press('ArrowRight');
await stage.waitForTimeout(400);
await settle();
await stage.waitForTimeout(600);
const thanks = await deckNow();
check('Thank you is on screen', thanks && thanks.deck === 'next' && thanks.id === 'thank-you', JSON.stringify(thanks && { deck: thanks.deck, id: thanks.id }));
const qr2 = await decode(path.join(outDir, `thanks-${W}.png`));
check(`QR on the thank you decodes at ${W}x${H}`, qr2 === 'https://meta-miut.vercel.app', String(qr2));
check('Remote note on the thank you', thanks ? await remoteShows(thanks.notes) : false);
await remote.screenshot({ path: path.join(outDir, 'remote-thanks.png') });

writeFileSync(path.join(outDir, 'stage-notes.json'), JSON.stringify({ W, H, before: nextIndex, results }, null, 2));
await browser.close();
if (results.some((r) => !r.ok)) process.exitCode = 1;
